import {
  createCaptureJobRequest,
  createErrorResponse,
  isExtensionResponse,
  type ExtensionResponse,
} from '@/features/extension/protocol';
import type { JobCaptureResult, JobSnapshot } from '@/types/job';
import { mapExtractedJob, type RawJobDom } from './mapper';
import { readJobFromPayload, resolveNuxtPayload } from './payload';
import { isJobCaptureResult, parseJobSnapshot } from './schema';
import { JOB_SELECTORS, type JobSelectors } from './selectors';
import {
  canonicalJobUrl,
  isSupportedJobUrl,
  jobCiphertextFromUrl,
} from './url';

export interface JobSource {
  isAvailable(): Promise<boolean>;
  capture(): Promise<JobSnapshot>;
}

export type JobCaptureErrorCode =
  'UNSUPPORTED_PAGE' | 'JOB_NOT_DETECTED' | 'JOB_CAPTURE_FAILED';

const JOB_CAPTURE_ERROR_CODES: ReadonlySet<string> =
  new Set<JobCaptureErrorCode>([
    'UNSUPPORTED_PAGE',
    'JOB_NOT_DETECTED',
    'JOB_CAPTURE_FAILED',
  ]);

export class JobCaptureError extends Error {
  constructor(
    readonly code: JobCaptureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'JobCaptureError';
  }
}

type InjectedJobResult =
  | { ok: true; payloadJson?: string; dom: RawJobDom }
  | { ok: false; reason: 'unsupported-page' };

interface JobTab {
  id?: number;
  url?: string;
}

interface JobCaptureBrowser {
  tabs: {
    query(queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<JobTab[]>;
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

export class UpworkDomJobSource implements JobSource {
  constructor(
    private readonly runtime: JobCaptureBrowser = browser as unknown as JobCaptureBrowser,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async isAvailable(): Promise<boolean> {
    const tab = await this.getActiveTab();
    if (!tab || !isSupportedJobUrl(tab.url)) return false;

    try {
      const [injection] = await this.runtime.scripting.executeScript({
        target: { tabId: tab.id },
        func: detectJobPage,
        args: [JOB_SELECTORS],
      });
      return injection?.result === true;
    } catch {
      return false;
    }
  }

  async capture(): Promise<JobSnapshot> {
    return (await this.captureWithMetadata()).snapshot;
  }

  async captureWithMetadata(): Promise<JobCaptureResult> {
    const tab = await this.getActiveTab();
    if (!tab) throw unsupportedPage();

    // The launcher content script is already on every Upwork page and answers
    // without `activeTab`. A launcher click opens the panel but grants nothing,
    // so the worker would otherwise see the tab with its URL scrubbed.
    const inPage = await this.captureInPage(tab.id);
    if (inPage) return inPage;

    // No launcher in the page (e.g. the extension was reloaded after the page
    // loaded): one injection under `activeTab`, as before.
    const ciphertext = jobCiphertextFromUrl(tab.url);
    if (!ciphertext) throw unsupportedPage();

    let result: InjectedJobResult | undefined;
    try {
      const [injection] = await this.runtime.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobFromDocument,
        args: [JOB_SELECTORS],
      });
      result = injection?.result;
    } catch {
      throw captureFailed();
    }

    return buildJobCapture(result, ciphertext, this.now().toISOString());
  }

  /** `undefined` means no launcher answered; a page that answered with an error throws it. */
  private async captureInPage(
    tabId: number,
  ): Promise<JobCaptureResult | undefined> {
    let response: unknown;
    try {
      response = await this.runtime.tabs.sendMessage(
        tabId,
        createCaptureJobRequest(),
      );
    } catch {
      return undefined;
    }

    if (!isExtensionResponse(response)) return undefined;
    if (!response.ok) {
      const { code, message } = response.error;
      throw JOB_CAPTURE_ERROR_CODES.has(code)
        ? new JobCaptureError(code as JobCaptureErrorCode, message)
        : captureFailed();
    }
    if (!isJobCaptureResult(response.data)) throw captureFailed();
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

export class ManualJobSource implements JobSource {
  constructor(
    private readonly job: JobSnapshot['job'],
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

  async capture(): Promise<JobSnapshot> {
    return parseJobSnapshot({
      source: 'manual',
      capturedAt: this.now().toISOString(),
      job: this.job,
    }).snapshot;
  }
}

/**
 * Runs in the launcher content script, on the page's own document, only when
 * the worker forwards a CAPTURE_JOB that a user click started. One read, no
 * observation.
 */
export function captureJobInPage(
  href: string,
  now: Date,
  requestId: string,
  jobDocument?: Document,
): ExtensionResponse<'CAPTURE_JOB'> {
  try {
    const ciphertext = jobCiphertextFromUrl(href);
    if (!ciphertext) throw unsupportedPage();
    const data = buildJobCapture(
      extractJobFromDocument(JOB_SELECTORS, jobDocument),
      ciphertext,
      now.toISOString(),
    );
    return { data, ok: true, requestId };
  } catch (error: unknown) {
    const captureError =
      error instanceof JobCaptureError ? error : captureFailed();
    return createErrorResponse(
      requestId,
      captureError.code,
      captureError.message,
    );
  }
}

function buildJobCapture(
  result: InjectedJobResult | undefined,
  ciphertext: string,
  capturedAt: string,
): JobCaptureResult {
  if (!result?.ok) {
    throw new JobCaptureError(
      'JOB_NOT_DETECTED',
      'We could not detect a job post on this page. Please try again.',
    );
  }

  try {
    const payload = result.payloadJson
      ? readJobFromPayload(resolveNuxtPayload(result.payloadJson))
      : undefined;

    return mapExtractedJob({
      payload,
      dom: result.dom,
      // The URL is the authority for resource identity; the snapshot carries
      // the canonical spelling whichever one the tab was on.
      ciphertext,
      url: canonicalJobUrl(ciphertext),
      capturedAt,
    });
  } catch {
    throw captureFailed();
  }
}

export function detectJobPage(
  selectors: JobSelectors,
  jobDocument?: Document,
): boolean {
  const root = jobDocument ?? document;
  return selectors.jobPageMarkers.some((selector) =>
    Boolean(root.querySelector(selector)),
  );
}

export function extractJobFromDocument(
  selectors: JobSelectors,
  jobDocument?: Document,
): InjectedJobResult {
  const root = jobDocument ?? document;

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

  if (
    !selectors.jobPageMarkers.some((selector) =>
      Boolean(root.querySelector(selector)),
    )
  ) {
    return { ok: false, reason: 'unsupported-page' };
  }

  const factList = selectors.facts.lists
    .flatMap((selector) => [...root.querySelectorAll(selector)])
    .find((list) =>
      selectors.facts.workloadIcon.some((selector) =>
        Boolean(list.querySelector(selector)),
      ),
    );

  const readFact = (iconCandidates: readonly string[]): string | undefined => {
    if (!factList) return undefined;
    const icon = readFirstElement(iconCandidates, factList);
    const row = icon?.closest('li');
    return row ? readFirstText(selectors.facts.value, row) : undefined;
  };

  const skillGroups = selectors.skills.groups.flatMap((selector) => [
    ...root.querySelectorAll(selector),
  ]);
  const skills = skillGroups.flatMap((group) => {
    const names = readManyTexts(selectors.skills.items, group);
    if (names.length === 0) return [];
    const relevanceLabel = readFirstText(selectors.skills.label, group);
    return names.map((name) => ({ name, relevanceLabel }));
  });

  const clientRoot = readFirstElement(selectors.client.root);
  const readClientText = (candidates: readonly string[]): string | undefined =>
    clientRoot ? readFirstText(candidates, clientRoot) : undefined;

  const payloadJson = readFirstText(selectors.payloadScript);
  return {
    ok: true,
    ...(payloadJson === undefined ? {} : { payloadJson }),
    dom: {
      title: readFirstText(selectors.title),
      description: readFirstText(selectors.description),
      questions: readManyTexts(selectors.questions),
      skills,
      workload: readFact(selectors.facts.workloadIcon),
      durationLabel: readFact(selectors.facts.durationIcon),
      experienceLevel: readFact(selectors.facts.experienceIcon),
      projectType: readFirstText(selectors.projectType),
      client: {
        country: readClientText(selectors.client.country),
        paymentVerified: clientRoot
          ? selectors.client.paymentVerified.some((selector) =>
              Boolean(clientRoot.querySelector(selector)),
            )
          : null,
        rating: readClientText(selectors.client.rating),
        reviewCount: readClientText(selectors.client.reviewCount),
        totalSpend: readClientText(selectors.client.totalSpend),
        hires: readClientText(selectors.client.hires),
        jobsPosted: readClientText(selectors.client.jobsPosted),
        avgHourlyRatePaid: readClientText(selectors.client.avgHourlyRatePaid),
        industry: readClientText(selectors.client.industry),
        companySize: readClientText(selectors.client.companySize),
      },
    },
  };
}

function unsupportedPage(): JobCaptureError {
  return new JobCaptureError(
    'UNSUPPORTED_PAGE',
    'Open a supported Upwork job post and try again.',
  );
}

function captureFailed(): JobCaptureError {
  return new JobCaptureError(
    'JOB_CAPTURE_FAILED',
    'We could not read this job. Please try again.',
  );
}
