export interface JobSelectors {
  jobPageMarkers: readonly string[];
  payloadScript: readonly string[];
  title: readonly string[];
  description: readonly string[];
  questions: readonly string[];
  skills: {
    groups: readonly string[];
    label: readonly string[];
    items: readonly string[];
  };
  projectType: readonly string[];
  facts: {
    lists: readonly string[];
    workloadIcon: readonly string[];
    durationIcon: readonly string[];
    experienceIcon: readonly string[];
    value: readonly string[];
  };
  client: {
    root: readonly string[];
    country: readonly string[];
    paymentVerified: readonly string[];
    rating: readonly string[];
    reviewCount: readonly string[];
    totalSpend: readonly string[];
    hires: readonly string[];
    jobsPosted: readonly string[];
    avgHourlyRatePaid: readonly string[];
    industry: readonly string[];
    companySize: readonly string[];
  };
}

export const JOB_SELECTORS = {
  jobPageMarkers: ['[data-cy="submit-proposal-button"]'],
  payloadScript: ['script#__NUXT_DATA__[type="application/json"]'],
  title: ['h4 > span.flex-1'],
  description: ['[data-test="Description"] p.multiline-text'],
  questions: ['ol.list-styled > li'],
  skills: {
    groups: ['div.span-md-12'],
    label: [':scope > strong'],
    items: [':scope > .skills-list a', '.skills-list a'],
  },
  projectType: ['ul.segmentations > li'],
  facts: {
    lists: ['ul.features'],
    workloadIcon: ['[data-cy="clock-hourly"]'],
    durationIcon: ['[data-cy^="duration"]'],
    experienceIcon: ['[data-cy="expertise"]'],
    value: [':scope > strong', 'strong'],
  },
  client: {
    root: ['[data-test="about-client-container"]'],
    country: ['[data-qa="client-location"] > strong'],
    paymentVerified: ['.payment-verified'],
    rating: ['.air3-rating-value-text'],
    reviewCount: ['.rating > span.nowrap'],
    totalSpend: ['[data-qa="client-spend"]'],
    hires: ['[data-qa="client-hires"]'],
    jobsPosted: ['[data-qa="client-job-posting-stats"]'],
    avgHourlyRatePaid: ['[data-qa="client-hourly-rate"]'],
    industry: ['[data-qa="client-company-profile-industry"]'],
    companySize: [
      '[data-qa="client-company-profile-size"]',
      '[data-qa="client-company-profile"]',
    ],
  },
} as const satisfies JobSelectors;
