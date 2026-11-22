import {
  createCaptureProfileRequest,
  createErrorResponse,
  isExtensionResponse,
  type ExtensionResponse,
} from '@/features/extension/protocol';
import { mapExtractedProfile } from './mapper';
import type {
  RawCertification,
  RawEducation,
  RawEmployment,
  RawExtractedProfile,
  RawLanguage,
  RawProfileCompleteness,
  RawPortfolioItem,
} from './parser';
import {
  PROFILE_SELECTORS,
  type CertificationSelectors,
  type EducationSelectors,
  type EmploymentSelectors,
  type LanguageSelectors,
  type PortfolioSelectors,
  type ProfileSelectors,
} from './selectors';
import {
  isProfileCaptureResult,
  parseProfileSnapshot,
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileCaptureResult,
  type ProfileSnapshot,
  type ProfileSnapshotInput,
} from './schema';
import { isSupportedOwnProfileUrl } from './url';

export { isSupportedOwnProfileUrl } from './url';

export interface ProfileSource {
  isAvailable(): Promise<boolean>;
  capture(): Promise<ProfileSnapshot>;
}

export type ProfileCaptureErrorCode =
  | 'UNSUPPORTED_PAGE'
  | 'OWN_PROFILE_NOT_DETECTED'
  | 'PROFILE_CAPTURE_FAILED';

const PROFILE_CAPTURE_ERROR_CODES: ReadonlySet<string> =
  new Set<ProfileCaptureErrorCode>([
    'UNSUPPORTED_PAGE',
    'OWN_PROFILE_NOT_DETECTED',
    'PROFILE_CAPTURE_FAILED',
  ]);

export class ProfileCaptureError extends Error {
  constructor(
    readonly code: ProfileCaptureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileCaptureError';
  }
}

type InjectedProfileResult =
  | { ok: true; raw: RawExtractedProfile }
  | { ok: false; reason: 'unsupported-page' };

interface ProfileTab {
  id?: number;
  url?: string;
}

interface ProfileCaptureBrowser {
  tabs: {
    query(queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<ProfileTab[]>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  scripting: {
    executeScript<TArgs extends unknown[], TResult>(injection: {
      target: { tabId: number };
      func: (...args: TArgs) => TResult;
      args: TArgs;
    }): Promise<Array<{ result?: TResult }>>;
  };
}

export class UpworkDomProfileSource implements ProfileSource {
  constructor(
    private readonly runtime: ProfileCaptureBrowser = browser as unknown as ProfileCaptureBrowser,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async isAvailable(): Promise<boolean> {
    const tab = await this.getActiveTab();
    if (!tab || !isSupportedOwnProfileUrl(tab.url)) return false;

    try {
      const [injection] = await this.runtime.scripting.executeScript({
        target: { tabId: tab.id },
        func: detectOwnProfile,
        args: [PROFILE_SELECTORS],
      });

      return injection?.result === true;
    } catch {
      return false;
    }
  }

  async capture(): Promise<ProfileSnapshot> {
    return (await this.captureWithMetadata()).snapshot;
  }

  async captureWithMetadata(): Promise<ProfileCaptureResult> {
    const tab = await this.getActiveTab();
    if (!tab) throw unsupportedPage();

    // The launcher content script is already on every Upwork page and answers
    // without `activeTab`. A launcher or side-panel click grants nothing, so
    // the worker would otherwise see the tab with its URL scrubbed.
    const inPage = await this.captureInPage(tab.id);
    if (inPage) return inPage;

    // No launcher in the page (e.g. the extension was reloaded after the page
    // loaded): one injection under `activeTab`, as before.
    if (!isSupportedOwnProfileUrl(tab.url)) throw unsupportedPage();

    let result: InjectedProfileResult | undefined;

    try {
      const [injection] = await this.runtime.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractProfileFromDocument,
        args: [PROFILE_SELECTORS],
      });
      result = injection?.result;
    } catch {
      throw captureFailed();
    }

    return buildProfileCapture(result, this.now().toISOString());
  }

  /** `undefined` means no launcher answered; a page that answered with an error throws it. */
  private async captureInPage(
    tabId: number,
  ): Promise<ProfileCaptureResult | undefined> {
    let response: unknown;
    try {
      response = await this.runtime.tabs.sendMessage(
        tabId,
        createCaptureProfileRequest(),
      );
    } catch {
      return undefined;
    }

    if (!isExtensionResponse(response)) return undefined;
    if (!response.ok) {
      const { code, message } = response.error;
      throw PROFILE_CAPTURE_ERROR_CODES.has(code)
        ? new ProfileCaptureError(code as ProfileCaptureErrorCode, message)
        : captureFailed();
    }
    if (!isProfileCaptureResult(response.data)) throw captureFailed();
    return response.data;
  }

  private async getActiveTab(): Promise<{ id: number; url?: string } | null> {
    const [tab] = await this.runtime.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id === undefined) return null;

    return { id: tab.id, url: tab.url };
  }
}

export class ManualProfileSource implements ProfileSource {
  constructor(
    private readonly profile: ProfileSnapshotInput['profile'],
    private readonly now: () => Date = () => new Date(),
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      await this.capture();
      return true;
    } catch {
      return false;
    }
  }

  async capture(): Promise<ProfileSnapshot> {
    return parseProfileSnapshot({
      source: 'manual',
      capturedAt: this.now().toISOString(),
      completeness: UNREADABLE_PROFILE_COMPLETENESS,
      profile: this.profile,
    }).snapshot;
  }
}

/**
 * Runs in the launcher content script, on the page's own document, only when
 * the worker forwards a CAPTURE_PROFILE that a user click started. One read, no
 * observation.
 */
export function captureProfileInPage(
  href: string,
  now: Date,
  requestId: string,
  profileDocument?: Document,
): ExtensionResponse<'CAPTURE_PROFILE'> {
  try {
    if (!isSupportedOwnProfileUrl(href)) throw unsupportedPage();
    const data = buildProfileCapture(
      extractProfileFromDocument(PROFILE_SELECTORS, profileDocument),
      now.toISOString(),
    );
    return { data, ok: true, requestId };
  } catch (error: unknown) {
    const captureError =
      error instanceof ProfileCaptureError ? error : captureFailed();
    return createErrorResponse(
      requestId,
      captureError.code,
      captureError.message,
    );
  }
}

function buildProfileCapture(
  result: InjectedProfileResult | undefined,
  capturedAt: string,
): ProfileCaptureResult {
  // The URL already matched, so this is not an unsupported page: the read ran
  // and could not find the own-profile markers. Reporting it as "open your own
  // profile" sends the user to a page they are already on and hides the real
  // cause, which is almost always selector drift.
  if (!result?.ok) throw ownProfileNotDetected();

  try {
    return mapExtractedProfile(result.raw, capturedAt);
  } catch {
    throw captureFailed();
  }
}

export function detectOwnProfile(
  selectors: ProfileSelectors,
  profileDocument?: Document,
): boolean {
  const root = profileDocument ?? document;
  return selectors.ownProfileMarkers.some((selector) =>
    Boolean(root.querySelector(selector)),
  );
}

export function extractProfileFromDocument(
  selectors: ProfileSelectors,
  profileDocument?: Document,
): InjectedProfileResult {
  const root = profileDocument ?? document;

  const readFirstText = (
    candidates: readonly string[],
    parent: ParentNode = root,
  ): string | undefined => {
    for (const selector of candidates) {
      const text = parent.querySelector(selector)?.textContent;
      if (text !== null && text !== undefined) return text;
    }

    return undefined;
  };

  /**
   * Reads prose whose line breaks matter. Upwork's `text-pre-line` spans keep
   * newlines in their text nodes; a `<br>` is turned into one as well, since
   * `textContent` would drop it.
   */
  const readFirstMultilineText = (
    candidates: readonly string[],
    parent: ParentNode = root,
  ): string | undefined => {
    const textWithBreaks = (node: Node): string => {
      // 3 is TEXT_NODE; the `Node` global is absent outside a real page.
      if (node.nodeType === 3) return node.textContent ?? '';
      if (node.nodeName === 'BR') return '\n';
      return [...node.childNodes].map(textWithBreaks).join('');
    };

    for (const selector of candidates) {
      const element = parent.querySelector(selector);
      if (element) return textWithBreaks(element);
    }

    return undefined;
  };

  const readFirstElement = (
    candidates: readonly string[],
    parent: ParentNode = root,
  ): Element | undefined => {
    for (const selector of candidates) {
      const element = parent.querySelector(selector);
      if (element) return element;
    }

    return undefined;
  };

  const readManyTexts = (
    candidates: readonly string[],
    parent: ParentNode = root,
  ): string[] => {
    for (const selector of candidates) {
      const elements = [...parent.querySelectorAll(selector)];
      if (elements.length === 0) continue;

      return elements.flatMap((element) =>
        element.textContent === null ? [] : [element.textContent],
      );
    }

    return [];
  };

  const readItems = <T>(
    candidates: readonly string[],
    readItem: (element: Element) => T,
  ): T[] => {
    for (const selector of candidates) {
      const elements = [...root.querySelectorAll(selector)];
      if (elements.length > 0) return elements.map(readItem);
    }

    return [];
  };

  if (
    !selectors.ownProfileMarkers.some((selector) =>
      root.querySelector(selector),
    )
  ) {
    return { ok: false, reason: 'unsupported-page' };
  }

  const readPortfolio = (group: PortfolioSelectors): RawPortfolioItem[] =>
    readItems(group.items, (item) => ({
      title: readFirstText(group.title, item),
      description: readFirstMultilineText(group.description, item),
      skills: readManyTexts(group.skills, item),
    }));

  const readEmployment = (group: EmploymentSelectors): RawEmployment[] =>
    readItems(group.items, (item) => ({
      title: readFirstText(group.title, item),
      company: readFirstText(group.company, item),
      period: readFirstText(group.period, item),
      description: readFirstMultilineText(group.description, item),
    }));

  const readEducation = (group: EducationSelectors): RawEducation[] =>
    readItems(group.items, (item) => ({
      school: readFirstText(group.school, item),
      degree: readFirstText(group.degree, item),
      period: readFirstText(group.period, item),
    }));

  const readCertifications = (
    group: CertificationSelectors,
  ): RawCertification[] =>
    readItems(group.items, (item) => ({
      name: readFirstText(group.name, item),
      issuer: readFirstText(group.issuer, item),
      year: readFirstText(group.year, item),
    }));

  const readLanguages = (group: LanguageSelectors): RawLanguage[] =>
    readItems(group.items, (item) => ({
      name: readFirstText(group.name, item),
      proficiency: readFirstText(group.proficiency, item),
    }));

  const readCompleteness = (): RawProfileCompleteness => {
    const group = selectors.completeness;
    const normalizedText = (element: Element | null | undefined): string =>
      (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const findHeading = (label: string): Element | undefined => {
      for (const selector of group.headingElements) {
        const heading = [...root.querySelectorAll(selector)].find(
          (candidate) => normalizedText(candidate) === label,
        );
        if (heading) return heading;
      }
      return undefined;
    };
    const readHeadingSibling = (
      label: string,
      valueSelectors: readonly string[],
    ): string | null | undefined => {
      const heading = findHeading(label);
      if (!heading) return null;

      const sibling = heading.parentElement?.nextElementSibling;
      if (!sibling) return undefined;
      return readFirstText(valueSelectors, sibling);
    };

    const introContainer = readFirstElement(group.introVideo.container);
    // The intro container disappears when no video exists. The adjacent Hours
    // section proves this sidebar region was readable, so a missing container
    // is a genuine absence rather than selector drift.
    const introRegionReadable = Boolean(
      findHeading(group.headings.hoursPerWeek),
    );
    const hasIntroVideo = introContainer
      ? group.introVideo.presentMarkers.some((selector) =>
          Boolean(introContainer.querySelector(selector)),
        )
      : introRegionReadable
        ? false
        : null;

    const personRoot = readFirstElement(group.profilePhoto.personRoot);
    const hasProfilePhoto = personRoot
      ? group.profilePhoto.image.some((selector) =>
          Boolean(personRoot.querySelector(selector)),
        )
      : null;

    const availabilityText = readHeadingSibling(
      group.headings.availabilityBadge,
      group.availabilityBadge.value,
    );
    const normalizedAvailability = availabilityText
      ?.replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const availabilityBadge =
      normalizedAvailability === 'on'
        ? true
        : normalizedAvailability === 'off'
          ? false
          : null;

    const verificationHeading = findHeading(group.headings.verifications);
    const verificationRoot = verificationHeading?.parentElement;
    let idVerified: boolean | null = null;
    let verifications: string[] | null = null;
    if (verificationRoot) {
      idVerified = false;
      verifications = [];
      const labels = group.verifications.labels.flatMap((selector) => [
        ...verificationRoot.querySelectorAll(selector),
      ]);

      for (const labelElement of labels) {
        const label = normalizedText(labelElement).replace(/:\s*$/u, '');
        let row = labelElement.parentElement;
        if (row?.tagName.toLowerCase() === 'span') row = row.parentElement;
        const rowText = normalizedText(row);
        const hasAddButton = group.verifications.addButtons.some((selector) =>
          Boolean(row?.querySelector(selector)),
        );
        const isId = label.toLowerCase() === group.verifications.idLabel.toLowerCase();
        const isPresent = isId
          ? rowText.includes(group.verifications.verifiedText)
          : !hasAddButton;

        if (isId) idVerified = isPresent;
        if (isPresent && label.length > 0) verifications.push(label);
      }
    }

    const licensesHeading = findHeading(group.headings.licenses);
    const licensesRoot = licensesHeading?.parentElement?.parentElement;
    let licenses: number | null = null;
    if (licensesRoot) {
      const list = licensesRoot.querySelector('ul');
      licenses = list
        ? group.licenses.items.reduce((maximum, selector) => {
            const count = list.querySelectorAll(selector).length;
            return Math.max(maximum, count);
          }, 0)
        : 0;
    }

    const linkedHeading = findHeading(group.headings.linkedAccounts);
    const linkedContainer = readFirstElement(group.linkedAccounts.container);
    const linkedAccounts = linkedContainer
      ? readManyTexts(group.linkedAccounts.names, linkedContainer)
      : linkedHeading
        ? []
        : null;

    return {
      hasIntroVideo,
      hasProfilePhoto,
      availabilityBadge,
      hoursPerWeek: readHeadingSibling(
        group.headings.hoursPerWeek,
        group.hoursPerWeek.value,
      ),
      avgResponseTime: readHeadingSibling(
        group.headings.avgResponseTime,
        group.avgResponseTime.value,
      ),
      idVerified,
      verifications,
      licenses,
      linkedAccounts,
    };
  };

  return {
    ok: true,
    raw: {
      name: readFirstText(selectors.name),
      title: readFirstText(selectors.title),
      overview: readFirstMultilineText(selectors.overview),
      hourlyRate: readFirstText(selectors.hourlyRate),
      skills: readManyTexts(selectors.skills),
      portfolio: readPortfolio(selectors.portfolio),
      employment: readEmployment(selectors.employment),
      education: readEducation(selectors.education),
      certifications: readCertifications(selectors.certifications),
      languages: readLanguages(selectors.languages),
      completeness: readCompleteness(),
    },
  };
}

function unsupportedPage(): ProfileCaptureError {
  return new ProfileCaptureError(
    'UNSUPPORTED_PAGE',
    'Open your own Upwork profile, then try again.',
  );
}

function captureFailed(): ProfileCaptureError {
  return new ProfileCaptureError(
    'PROFILE_CAPTURE_FAILED',
    'We could not read your profile. Please try again.',
  );
}

function ownProfileNotDetected(): ProfileCaptureError {
  return new ProfileCaptureError(
    'OWN_PROFILE_NOT_DETECTED',
    "This looks like an Upwork profile page, but we couldn't read it. Upwork may have changed its layout.",
  );
}
