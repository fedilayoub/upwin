export interface ItemSelectors {
  items: readonly string[];
}

export interface PortfolioSelectors extends ItemSelectors {
  title: readonly string[];
  description: readonly string[];
  skills: readonly string[];
}

export interface EmploymentSelectors extends ItemSelectors {
  title: readonly string[];
  company: readonly string[];
  period: readonly string[];
  description: readonly string[];
}

export interface EducationSelectors extends ItemSelectors {
  school: readonly string[];
  degree: readonly string[];
  period: readonly string[];
}

export interface CertificationSelectors extends ItemSelectors {
  name: readonly string[];
  issuer: readonly string[];
  year: readonly string[];
}

export interface LanguageSelectors extends ItemSelectors {
  name: readonly string[];
  proficiency: readonly string[];
}

export interface CompletenessSelectors {
  headingElements: readonly string[];
  headings: {
    availabilityBadge: string;
    hoursPerWeek: string;
    avgResponseTime: string;
    verifications: string;
    licenses: string;
    linkedAccounts: string;
  };
  introVideo: {
    container: readonly string[];
    presentMarkers: readonly string[];
  };
  profilePhoto: {
    personRoot: readonly string[];
    image: readonly string[];
  };
  availabilityBadge: {
    value: readonly string[];
  };
  hoursPerWeek: {
    value: readonly string[];
  };
  avgResponseTime: {
    value: readonly string[];
  };
  verifications: {
    labels: readonly string[];
    addButtons: readonly string[];
    idLabel: string;
    verifiedText: string;
  };
  licenses: {
    items: readonly string[];
  };
  linkedAccounts: {
    container: readonly string[];
    names: readonly string[];
  };
}

export interface ProfileSelectors {
  ownProfileMarkers: readonly string[];
  name: readonly string[];
  title: readonly string[];
  overview: readonly string[];
  hourlyRate: readonly string[];
  skills: readonly string[];
  portfolio: PortfolioSelectors;
  employment: EmploymentSelectors;
  education: EducationSelectors;
  certifications: CertificationSelectors;
  languages: LanguageSelectors;
  completeness: CompletenessSelectors;
}

export const PROFILE_SELECTORS = {
  ownProfileMarkers: [
    '[data-test="pib-edit-button"]',
    '[data-ev-label="boost_profile_edit_button"]',
  ],
  name: [
    'h2[itemprop="name"]',
    '.identity-content h2.h2',
    '.identity-container h2',
  ],
  title: [
    'h3:has(button[aria-label="Edit title"])',
    'h3.mb-0.pt-lg-2x.h4',
    '.mb-10x h3.mb-0.h4',
  ],
  overview: [
    'div.air3-line-clamp span.text-body.text-pre-line.break',
    '.air3-line-clamp-wrapper > .air3-line-clamp > span.text-body.text-pre-line.break',
  ],
  hourlyRate: [
    'h3:has(button[aria-label="Edit hourly rate"])',
    'h3.d-inline.h5.nowrap',
    '.mb-10x h3.d-inline.nowrap',
  ],
  skills: [
    'section.air3-card-section:has([suit-label="skills"]) .skill-name',
    'div.skills .skill-name',
    'div.skills .air3-token',
  ],
  portfolio: {
    items: [
      'div.portfolio-v2-shelf-thumbnail',
      '.air3-tab-pane[role="tabpanel"] > div > .air3-grid-container.mt-6x > .span-6.span-md-4',
    ],
    title: [
      '.portfolio-v2-shelf-thumbnail > .mt-3x > a.d-flex.flex-column.no-underline',
      '.mt-3x > a.d-flex.flex-column.no-underline',
    ],
    // The captured shelf cards expose only a title. Detail prose and skills are
    // not present in the one-shot DOM, so there is no truthful selector yet.
    description: [],
    skills: [],
  },
  employment: {
    items: [
      '.air3-card-section.px-0:has(button[aria-label*="Employment history item"])',
      '.air3-card-section.px-0:has(.air3-line-clamp-wrapper.mt-3x)',
    ],
    title: ['h4[role="presentation"].my-0', '.flex-1 > h4.my-0'],
    // Upwork renders "title | company" as one heading in this capture.
    company: [],
    period: [
      '.d-flex + .mt-3x.text-light-on-inverse',
      '.mt-3x.text-light-on-inverse',
    ],
    description: [
      '.air3-line-clamp span.text-pre-line.break.text-light',
      '.air3-line-clamp-wrapper.mt-3x span.text-pre-line.break.text-light',
    ],
  },
  education: {
    items: [
      'div:has(> div > h5[role="presentation"] + button[aria-label="Add education"]) > ul.list-unstyled > li.d-flex.justify-space-between.mb-3x',
      'div:has(> div > h5[role="presentation"]):has(> div > button[aria-label="Add education"]) > ul.list-unstyled > li',
    ],
    school: [
      'strong[role="presentation"].mb-0',
      'strong[role="presentation"]',
    ],
    degree: [
      'strong[role="presentation"] + div.text-light',
      'div > .text-light',
    ],
    period: [],
  },
  certifications: {
    items: [
      'section.air3-card-sections:has([suit-label="certifications"]) div.certificate',
      'div.certificate',
    ],
    name: [
      '.certificate-details-column h4[role="presentation"]',
      '.certificate-details-column h4.mb-3x',
    ],
    issuer: [
      '.certificate-details-column > .mb-2x.text-base:not(:has(> span))',
      '.certificate-details-column > .mb-2x.text-base',
    ],
    year: ['.certificate-details-column > .mb-2x.text-base > span'],
  },
  languages: {
    items: [
      'div:has(> div > h5[role="presentation"] + div button[aria-label="Add language"]) > ul.list-unstyled > li.mt-2x',
      'div:has(> div > h5[role="presentation"]):has(> div > div button[aria-label="Edit language"]) > ul.list-unstyled > li',
    ],
    name: [
      'strong.d-inline-block.vertical-align-middle',
      'strong',
    ],
    proficiency: [
      'strong + span.d-inline-block.vertical-align-middle.text-light',
      'span.text-light',
    ],
  },
  completeness: {
    // These headings and sibling relationships are taken directly from
    // a real captured profile page. Connects and "Boost your profile" are
    // deliberately not captured: the former is account currency and the
    // latter is paid advertising, neither a profile-completeness signal.
    headingElements: ['h2', 'h3', 'h4', 'h5', 'h6'],
    headings: {
      availabilityBadge: 'Availability badge',
      hoursPerWeek: 'Hours per week',
      avgResponseTime: 'Avg. response',
      verifications: 'Verifications',
      licenses: 'Licenses',
      linkedAccounts: 'Linked accounts',
    },
    introVideo: {
      container: ['.cfe-ui-profile-video-intro'],
      presentMarkers: [
        '[data-testid="video-thumbnail-container"]',
        'button[aria-label="Play video"]',
        'button[aria-label="Delete introduction video"]',
      ],
    },
    profilePhoto: {
      personRoot: ['[itemscope][itemtype="http://schema.org/Person"]'],
      image: ['img[alt]'],
    },
    availabilityBadge: {
      value: ['p'],
    },
    hoursPerWeek: {
      value: ['span'],
    },
    avgResponseTime: {
      value: ['span[role="button"]'],
    },
    verifications: {
      labels: ['strong'],
      addButtons: ['button[aria-label^="Add "]'],
      idLabel: 'ID',
      verifiedText: 'Verified',
    },
    licenses: {
      items: [':scope > li'],
    },
    linkedAccounts: {
      container: ['[data-qa="linked-accounts"]'],
      names: ['.title'],
    },
  },
} as const satisfies ProfileSelectors;
