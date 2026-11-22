import type { VideoDictionary } from '@/i18n/video-types';
import type {
  FunnelWindow,
  OutputLanguage,
  ProposalOutcomeStatus,
} from '@/lib/api';

export interface Dictionary extends VideoDictionary {
  metadata: {
    title: string;
    description: string;
  };
  common: {
    darkTheme: string;
    language: string;
    languages: { en: string; fr: string };
    lightTheme: string;
    preferences: string;
  };
  navigation: {
    /** Section titles in the app sidebar. */
    groupWork: string;
    groupAboutYou: string;
    groupSettings: string;
    overview: string;
    applications: string;
    videos: string;
    context: string;
    goals: string;
    proposalStyle: string;
    connection: string;
    models: string;
    prompts: string;
    /** Sidebar footer label. */
    edition: string;
  };
  dashboard: {
    title: string;
    description: string;
    setup: {
      title: string;
      description: string;
      /** `{done}` and `{total}` are replaced. */
      progress: string;
      done: string;
      locked: string;
      steps: {
        skills: {
          title: string;
          description: string;
          action: string;
          /** Shown instead when details are saved but not confirmed. */
          confirmDescription: string;
          confirmAction: string;
        };
        goal: { title: string; description: string; action: string };
        extension: { title: string; description: string; action: string };
      };
    };
    kpis: {
      winningScore: string;
      profileAnalyses: string;
      jobsAnalyzed: string;
      highFitJobs: string;
      proposalsDrafted: string;
      replyRate: string;
      noScore: string;
      activeGoal: string;
      analysesLast30Days: string;
      jobsLast30Days: string;
      highFitThreshold: string;
      proposalsLast30Days: string;
      replyFraction: string;
      replyEmpty: string;
      minimumSample: string;
    };
    scoreTrend: {
      title: string;
      description: string;
      scoreLabel: string;
      noAnalysis: string;
      noAnalysisMonth: string;
      caveat: string;
      goalChange: string;
      empty: string;
      truncated: string;
    };
    activity: {
      title: string;
      description: string;
      timeZone: string;
      drafted: string;
      sent: string;
      activeDays: string;
      currentStreak: string;
      longestStreak: string;
      sendRate: string;
      weeksUnit: string;
      legend: string;
      less: string;
      more: string;
      weekdays: [string, string, string, string, string, string, string];
      tooltip: string;
    };
    funnel: {
      title: string;
      description: string;
      windows: Record<'30d' | '90d' | '365d' | 'all', string>;
      steps: Record<
        | 'jobsAnalyzed'
        | 'proposalsDrafted'
        | 'sent'
        | 'replied'
        | 'interviewing'
        | 'hired',
        string
      >;
      shareEmpty: string;
    };
    sections: {
      title: string;
      description: string;
      first: string;
      latest: string;
      noDelta: string;
      labels: Record<
        | 'positioning'
        | 'overview'
        | 'title'
        | 'skills'
        | 'portfolio'
        | 'experience'
        | 'trust'
        | 'goalAlignment',
        string
      >;
    };
    applications: {
      title: string;
      description: string;
      job: string;
      matchScore: string;
      status: string;
      sentDate: string;
      empty: string;
      validation: { checkFields: string; invalidChoice: string };
      messages: { saved: string; genericError: string };
    };
    recentActivity: {
      title: string;
      description: string;
      empty: string;
      notScored: string;
      kinds: Record<
        | 'profile-analysis'
        | 'job-analysis'
        | 'proposal-draft'
        | 'proposal-outcome',
        string
      >;
    };
    outcomeStatuses: Record<ProposalOutcomeStatus, string>;
  };
  applications: {
    title: string;
    description: string;
    stats: {
      applied: string;
      appliedHint: string;
      viewed: string;
      messaged: string;
      interviewing: string;
      hired: string;
      noResponse: string;
      windowLabel: string;
      windows: Record<FunnelWindow, string>;
    };
    board: {
      matchScore: string;
      connects: string;
      enrolled: string;
      sent: string;
      openJob: string;
      dragHint: string;
    };
    view: {
      label: string;
      board: string;
      table: string;
    };
    table: {
      job: string;
      matchScore: string;
      status: string;
      date: string;
    };
    empty: {
      title: string;
      description: string;
    };
    validation: { checkFields: string; invalidChoice: string };
    messages: { saved: string; genericError: string };
  };
  goals: {
    title: string;
    description: string;
    activeTitle: string;
    noActive: string;
    createTitle: string;
    createDescription: string;
    createAnotherTitle: string;
    savedGoalsTitle: string;
    activeBadge: string;
    inactiveBadge: string;
    switchGoal: string;
    switchingGoal: string;
    saveGoal: string;
    savingGoal: string;
    createGoal: string;
    creatingGoal: string;
    newGoal: string;
    editGoal: string;
    editTitle: string;
    editDescription: string;
    tableDescription: string;
    deleteGoal: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteActiveNote: string;
    deleteConfirm: string;
    deletingGoal: string;
    cancel: string;
    columns: {
      goal: string;
      targetWork: string;
      hourlyRate: string;
      status: string;
      updated: string;
      actions: string;
    };
    formSections: {
      focus: string;
      focusDescription: string;
      work: string;
      workDescription: string;
      rate: string;
      rateDescription: string;
    };
    fields: {
      objective: string;
      targetRole: string;
      targetRolePlaceholder: string;
      targetProjectTypes: string;
      targetClients: string;
      preferredSkills: string;
      targetRate: string;
      targetRateMin: string;
      targetRateMax: string;
      targetRateEnabled: string;
      targetRateOff: string;
      optional: string;
    };
    chips: {
      add: string;
      search: string;
      empty: string;
      /** Carries a `{value}` placeholder. */
      create: string;
      /** Carries a `{value}` placeholder. */
      remove: string;
      limit: string;
    };
    suggestions: {
      targetRole: readonly string[];
      targetProjectTypes: readonly string[];
      targetClients: readonly string[];
      preferredSkills: readonly string[];
    };
    objectives: {
      'first-client': string;
      'more-clients': string;
      'more-responses': string;
      'higher-paying-projects': string;
      scale: string;
    };
    validation: {
      checkFields: string;
      required: string;
      invalidObjective: string;
      invalidNumber: string;
      rateOrder: string;
      tooManyItems: string;
      tooLong: string;
    };
    messages: {
      created: string;
      updated: string;
      activated: string;
      deleted: string;
      deleteError: string;
      genericError: string;
    };
  };
  promptConsole: {
    title: string;
    description: string;
    tabs: {
      compose: string;
      preview: string;
      dryRun: string;
      history: string;
    };
    editorState: {
      unsaved: string;
      saved: string;
      editingDraft: string;
      newDraft: string;
      liveLabel: string;
    };
    compose: {
      baseTitle: string;
      baseDescription: string;
      strategiesFilled: string;
      anchorsFilled: string;
      complete: string;
      incomplete: string;
      notesTitle: string;
      notesDescription: string;
    };
    confirmPublish: {
      title: string;
      description: string;
      cancel: string;
      action: string;
    };
    confirmReset: {
      title: string;
      description: string;
      cancel: string;
      action: string;
    };
    active: {
      title: string;
      revision: string;
      codeDefault: string;
      author: string;
      codeOwned: string;
      activated: string;
      notes: string;
      noNotes: string;
    };
    editor: {
      title: string;
      description: string;
      persona: string;
      policy: string;
      strategies: string;
      strategiesDescription: string;
      anchors: string;
      anchorsDescription: string;
      score: string;
      notes: string;
    };
    actions: {
      saveDraft: string;
      preview: string;
      dryRun: string;
      publish: string;
      reset: string;
      saveBeforePreview: string;
      editDraft: string;
      rollback: string;
    };
    history: {
      title: string;
      description: string;
      empty: string;
      live: string;
    };
    status: { draft: string; active: string; retired: string };
    preview: {
      title: string;
      description: string;
      baseline: string;
      candidate: string;
      empty: string;
    };
    dryRun: {
      title: string;
      description: string;
      empty: string;
      sectionScores: string;
    };
    messages: {
      draftSaved: string;
      draftSaveError: string;
      previewReady: string;
      previewError: string;
      dryRunReady: string;
      dryRunError: string;
      published: string;
      publishError: string;
      reset: string;
      resetError: string;
    };
  };
  modelConsole: {
    title: string;
    description: string;
    riskTitle: string;
    scoreWarning: string;
    capabilityLabels: Record<
      'profileAnalyzer' | 'jobMatchEvaluator' | 'proposalWriter',
      string
    >;
    capabilityDescriptions: Record<
      'profileAnalyzer' | 'jobMatchEvaluator' | 'proposalWriter',
      string
    >;
    sourceLabels: Record<'selection' | 'environment' | 'default', string>;
    current: string;
    primary: string;
    fallback: string;
    search: string;
    searchPlaceholder: string;
    noModels: string;
    pricing: string;
    context: string;
    estimate: string;
    recentRuns: string;
    noRuns: string;
    tokenMedian: string;
    notes: string;
    notesPlaceholder: string;
    warnings: string;
    actions: { save: string; reset: string; probe: string };
    probe: {
      title: string;
      primary: string;
      fallback: string;
      servedBy: string;
      failed: string;
      latency: string;
    };
    messages: {
      saved: string;
      saveError: string;
      reset: string;
      resetError: string;
      probeReady: string;
      probeError: string;
    };
  };
  proposals: {
    title: string;
    description: string;
    formTitle: string;
    formDescription: string;
    sections: {
      writingTitle: string;
      writingDescription: string;
      personalTitle: string;
      personalDescription: string;
      guardrailTitle: string;
    };
    fieldHelp: {
      proposalTone: string;
      language: string;
      signOffName: string;
    };
    fields: {
      proposalLength: string;
      proposalTone: string;
      answerLength: string;
      language: string;
      signOffName: string;
      signOffNamePlaceholder: string;
      customInstructions: string;
      customInstructionsPlaceholder: string;
      optional: string;
      characterCount: string;
    };
    proposalLengths: {
      short: { label: string; description: string };
      medium: { label: string; description: string };
      long: { label: string; description: string };
    };
    proposalTones: {
      professional: string;
      technical: string;
      conversational: string;
      friendly: string;
    };
    answerLengths: {
      brief: { label: string; description: string };
      standard: { label: string; description: string };
      detailed: { label: string; description: string };
    };
    /** One label per output language, in the interface's language. */
    languages: Record<OutputLanguage, string>;
    customInstructionsHelp: string;
    factualBoundary: string;
    save: string;
    saving: string;
    unsavedChanges: string;
    allSaved: string;
    validation: {
      checkFields: string;
      invalidChoice: string;
      tooLong: string;
    };
    messages: {
      saved: string;
      genericError: string;
    };
  };
  onboarding: {
    title: string;
    description: string;
    uploadChoiceTitle: string;
    uploadChoiceDescription: string;
    uploadChoiceAction: string;
    manualChoiceTitle: string;
    manualChoiceDescription: string;
    manualChoiceAction: string;
    currentContext: string;
    trustedStatus: string;
    draftStatus: string;
    reviewCurrent: string;
    backToOverview: string;
    recommended: string;
    choicesTitle: string;
    choicesDescription: string;
    replaceTitle: string;
    replaceDescription: string;
    uploadChoicePoints: { one: string; two: string; three: string };
    manualChoicePoints: { one: string; two: string; three: string };
    steps: {
      label: string;
      addTitle: string;
      addDescription: string;
      reviewTitle: string;
      reviewDescription: string;
      confirmTitle: string;
      confirmDescription: string;
    };
    summary: {
      title: string;
      completeness: string;
      filled: string;
      years: string;
      yearsUnit: string;
      roles: string;
      skills: string;
      projects: string;
      missingTitle: string;
      missingDescription: string;
      allFilled: string;
      updated: string;
      openReview: string;
      edit: string;
    };
    upload: {
      title: string;
      description: string;
      fileLabel: string;
      fileHint: string;
      submit: string;
      submitting: string;
      privacy: string;
      invalidFile: string;
      tooLarge: string;
      dropTitle: string;
      dropHint: string;
      selected: string;
      changeFile: string;
      whatHappens: string;
      whatHappensDescription: string;
    };
    manual: {
      title: string;
      description: string;
      editTitle: string;
      editDescription: string;
      resetTrustWarning: string;
      optional: string;
      atLeastOne: string;
      sections: {
        experience: string;
        experienceDescription: string;
        portfolio: string;
        portfolioDescription: string;
        positioning: string;
        positioningDescription: string;
        preferences: string;
        preferencesDescription: string;
      };
      fields: {
        experienceYears: string;
        experienceYearsEnabled: string;
        experienceYearsOff: string;
        yearsUnit: string;
        skills: string;
        roles: string;
        roleTitle: string;
        roleTitlePlaceholder: string;
        roleCompany: string;
        roleCompanyPlaceholder: string;
        rolePeriod: string;
        rolePeriodPlaceholder: string;
        roleDescription: string;
        roleDescriptionPlaceholder: string;
        portfolio: string;
        projectTitle: string;
        projectTitlePlaceholder: string;
        projectDescription: string;
        projectDescriptionPlaceholder: string;
        projectUrl: string;
        projectUrlPlaceholder: string;
        projectSkills: string;
        targetRole: string;
        targetRolePlaceholder: string;
        targetClients: string;
        targetIndustries: string;
        targetRate: string;
        targetRateEnabled: string;
        targetRateOff: string;
        tone: string;
        tonePlaceholder: string;
        services: string;
      };
      rows: {
        addRole: string;
        removeRole: string;
        noRoles: string;
        roleLabel: string;
        addProject: string;
        removeProject: string;
        noProjects: string;
        projectLabel: string;
      };
      chips: {
        add: string;
        search: string;
        empty: string;
        create: string;
        remove: string;
        limit: string;
      };
      suggestions: {
        skills: string[];
        targetRole: string[];
        targetClients: string[];
        targetIndustries: string[];
        services: string[];
        tone: string[];
      };
      saveAndReview: string;
      saving: string;
      saveEdits: string;
      cancel: string;
    };
    review: {
      title: string;
      description: string;
      untrustedTitle: string;
      untrustedDescription: string;
      trustedTitle: string;
      trustedDescription: string;
      noDraftTitle: string;
      noDraftDescription: string;
      startOnboarding: string;
      sourceLabel: string;
      sourceCv: string;
      sourceManual: string;
      sourceMixed: string;
      experienceSection: string;
      positioningSection: string;
      portfolioSection: string;
      preferencesSection: string;
      yearsExperience: string;
      roles: string;
      skills: string;
      targetRole: string;
      targetClients: string;
      targetIndustries: string;
      targetRate: string;
      tone: string;
      services: string;
      noDetails: string;
      sectionEmpty: string;
      detailsTitle: string;
      edit: string;
      confirm: string;
      confirming: string;
      cannotConfirm: string;
      confirmed: string;
      replacementNotice: string;
      startOverTitle: string;
      startOverDescription: string;
      uploadDifferentCv: string;
      deleteAndStartScratch: string;
      deleteConfirmTitle: string;
      deleteConfirmDescription: string;
      deleteContextLost: string;
      deleteContextPreserved: string;
      deleteConfirmAction: string;
      deleting: string;
      cancelDelete: string;
      deleteConfirmationRequired: string;
      genericError: string;
    };
    validation: {
      checkFields: string;
      required: string;
      invalidNumber: string;
      invalidUrl: string;
      tooLong: string;
      tooManyItems: string;
    };
  };
  settings: {
    connection: {
      title: string;
      description: string;
      api: {
        title: string;
        url: string;
        status: string;
        reachable: string;
        unreachable: string;
        unreachableHint: string;
        token: string;
        tokenSet: string;
        tokenUnset: string;
        password: string;
        passwordSet: string;
        passwordUnset: string;
      };
      ai: {
        title: string;
        description: string;
        unknown: string;
        modelsLink: string;
      };
      extension: {
        title: string;
        description: string;
        steps: string[];
        apiUrlLabel: string;
      };
    };
  };
  unlock: {
    title: string;
    description: string;
    password: string;
    submit: string;
    wrong: string;
  };
}
