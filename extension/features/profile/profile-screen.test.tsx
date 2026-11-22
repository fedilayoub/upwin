import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  PROFILE_SECTION_IDS,
  type ActiveProfileGoal,
  type ProfileAnalysis,
  type ProfileAnalysisProgress,
  type ProfileSnapshotDiff,
  type ProfileSuggestion,
} from '@/types/profile';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '@/features/upwork/profile/schema';

vi.mock('@/features/connection/connection-context', () => ({
  useConnection: () => ({ getToken: vi.fn() }),
  useAppUrl: () => 'http://localhost:3000',
}));
import {
  AnalysisProgress,
  ProfileAnalysisError,
  ProfileBreakdown,
  ProfileEntry,
  CompletenessMeter,
  ProfileProgress,
  PriorityList,
  ProfileResults,
  runCapturedAnalysis,
  SnapshotDiffPanel,
  ProfileSuggestionContent,
} from './profile-screen';

const analysis: ProfileAnalysis = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  createdAt: '2026-08-20T12:00:00.000Z',
  winningScore: 72,
  completenessScore: 75,
  previousWinningScore: 65,
  goal: {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b',
    objective: 'first-client',
    targetRole: 'Senior Frontend Developer',
  },
  summary: 'Your profile is credible, but broader than your target work.',
  strongestSection: 'trust',
  biggestOpportunity: 'goalAlignment',
  sectionScores: [
    { id: 'goalAlignment', score: 40, criteria: [] },
    { id: 'trust', score: 91, criteria: [] },
    // Criteria present but no evidence: nothing to reveal, so no disclosure.
    {
      id: 'experience',
      score: 84,
      criteria: [
        { id: 'experienceRelevance', label: 'Relevance', evidence: [] },
        { id: 'experienceAuthority', label: 'Authority', evidence: [] },
      ],
    },
    {
      id: 'portfolio',
      score: 62,
      criteria: [
        { id: 'portfolioDepth', label: 'Portfolio depth', evidence: [] },
        {
          id: 'portfolioTargetAlignment',
          label: 'Target alignment',
          evidence: ['One of four projects supports the SaaS target.'],
        },
      ],
    },
    { id: 'skills', score: 88, criteria: [] },
    { id: 'title', score: 78, criteria: [] },
    {
      id: 'overview',
      score: 64,
      criteria: [
        { id: 'overviewPresence', label: 'Overview presence', evidence: [] },
        {
          id: 'overviewClientFocus',
          label: 'Client focus',
          evidence: ['The overview opens with “I have ten years of experience.”'],
        },
        { id: 'overviewKeywords', label: 'Target keyword coverage', evidence: [] },
        {
          id: 'overviewValueProposition',
          label: 'Value proposition',
          evidence: ['No outcome is named for the client.'],
        },
        { id: 'overviewClarity', label: 'Clarity', evidence: [] },
        {
          id: 'overviewProof',
          label: 'Proof',
          evidence: ['No metric appears in the overview.'],
        },
      ],
    },
    {
      id: 'positioning',
      score: 58,
      criteria: [
        {
          id: 'positioningClarity',
          label: 'Positioning clarity',
          evidence: ['The title says “Software Developer” with no client type.'],
        },
        { id: 'positioningDifferentiation', label: 'Differentiation', evidence: [] },
      ],
    },
  ],
  priorities: [
    {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
      section: 'overview',
      rank: 1,
      impact: 'high',
      estimatedMinutes: 5,
      recommendation: 'Lead with the client problem you solve.',
      reason: 'The opening focuses on experience instead of client outcomes.',
      evidence: ['The overview opens with “I have ten years of experience.”'],
    },
    {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1d',
      section: 'portfolio',
      rank: 2,
      impact: 'high',
      estimatedMinutes: 15,
      recommendation: 'Show a target-relevant SaaS project first.',
      reason: 'The strongest target-fit project is not prominent.',
      evidence: ['The first portfolio item is “Marketing website.”'],
    },
    {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1e',
      section: 'title',
      rank: 3,
      impact: 'medium',
      estimatedMinutes: 2,
      recommendation: 'Narrow the title to the configured role.',
      reason: 'The current title is broader than the target role.',
      evidence: ['The title is “Software Developer.”'],
    },
  ],
  versions: {
    prompt: 'profile-analyzer-v1',
    rubric: 'upwork-profile-v1',
    scoring: 'scoring-v1',
    provider: 'openai',
    model: 'openai/gpt-4.1-nano',
  },
};

const activeGoal: ActiveProfileGoal = {
  id: analysis.goal.id,
  objective: analysis.goal.objective,
  targetRole: analysis.goal.targetRole,
  targetProjectTypes: ['SaaS applications'],
  targetClients: ['Startups'],
  preferredSkills: ['React', 'Next.js'],
  targetRate: null,
  isActive: true,
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
};

const progress: ProfileAnalysisProgress = {
  latest: {
    id: analysis.id,
    createdAt: analysis.createdAt,
    winningScore: analysis.winningScore,
  },
  deltaSinceFirst: 8,
  trend: [
    {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa19',
      createdAt: '2026-08-19T12:00:00.000Z',
      winningScore: 64,
    },
    {
      id: analysis.id,
      createdAt: analysis.createdAt,
      winningScore: analysis.winningScore,
    },
  ],
  sectionDeltas: PROFILE_SECTION_IDS.map((id) => ({
    id,
    firstScore: id === 'overview' ? 58 : 70,
    latestScore: id === 'overview' ? 82 : 70,
    delta: id === 'overview' ? 24 : 0,
  })),
};

const snapshotDiff: ProfileSnapshotDiff = {
  fromSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa30',
  toSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa31',
  fromCapturedAt: '2026-08-19T12:00:00.000Z',
  toCapturedAt: '2026-08-20T12:00:00.000Z',
  changes: {
    title: { status: 'changed' },
    overview: { status: 'updated' },
    portfolio: { status: 'changed', added: 1, removed: 0 },
    skills: { status: 'unchanged', added: [], removed: [] },
  },
};

describe('AnalysisProgress', () => {
  it('moves the branded orb through profile-analysis states', () => {
    const captureMarkup = renderToStaticMarkup(
      <AnalysisProgress progressIndex={0} />,
    );
    const recommendationsMarkup = renderToStaticMarkup(
      <AnalysisProgress progressIndex={5} />,
    );

    expect(captureMarkup).toContain('data-orb-state="searching"');
    expect(captureMarkup).toContain('Profile captured…');
    expect(recommendationsMarkup).toContain('data-orb-state="weaving"');
    expect(recommendationsMarkup).toContain('Building recommendations…');
    expect(recommendationsMarkup).toContain('data-analysis-progress');
    expect(recommendationsMarkup).toContain(
      'aria-label="Profile analysis progress"',
    );
  });

  it('shows captured evidence without verifying timer-only stages', () => {
    const snapshot: ProfileSnapshot = {
      source: 'upwork',
      capturedAt: '2026-09-04T10:00:00.000Z',
      completeness: {
        ...UNREADABLE_PROFILE_COMPLETENESS,
        hasProfilePhoto: true,
        verifications: ['Identity'],
      },
      profile: {
        title: 'Senior Frontend Developer',
        overview: 'I build accessible SaaS products.',
        skills: ['TypeScript'],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
      },
    };
    const markup = renderToStaticMarkup(
      <AnalysisProgress
        goalLabel="SaaS dashboard work"
        progressIndex={4}
        snapshot={snapshot}
      />,
    );

    expect(markup).toContain('Title');
    expect(markup).toContain('Overview');
    expect(markup).toContain('1 skill');
    expect(markup).toContain('Photo');
    expect(markup).toContain('1 verification');
    expect(markup).toContain('SaaS dashboard work');
    expect(markup).toMatch(
      /data-status="complete"[^>]*><div[^>]*><svg[^>]*lucide-circle-dot/,
    );
  });
});

describe('ProfileResults', () => {
  it('renders the Winning Score and the delta from the prior analysis', () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        analysis={analysis}
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    expect(markup).toContain('Winning Score');
    expect(markup).toContain('72');
    expect(markup).toContain('/ 100');
    expect(markup).toContain('+7 from previous analysis');
    expect(markup).toContain('data-score-gauge');
    expect(markup).toContain('aria-label="Winning Score: 72 out of 100"');
    expect(markup).toContain('@container/profile-results');
    expect(markup).toContain('max-w-full');
    expect(markup).toContain('overflow-x-clip');
    expect(markup).toContain(
      '@min-[760px]/profile-results:grid-cols-12',
    );
    expect(markup).toContain('@min-[760px]/profile-results:col-span-6');
    expect(markup).toContain('@container/score-summary');
    expect(markup).toContain(
      '@min-[340px]/score-summary:grid-cols-[minmax(0,1fr)_minmax(138px,0.72fr)]',
    );
    expect(markup).toContain(
      '@min-[320px]/score-summary:grid-cols-2',
    );
    expect(markup).toContain('data-profile-completeness');
    expect(markup).toContain('data-score-trend');
    expect(markup).toContain('Evidence from your profile');
    expect(markup).toContain('I have ten years of experience');
    expect(markup).not.toContain('Upwork Profile Score');
  });

  // The score-history chart is an ECharts canvas with an explicit pixel width,
  // so it is its own min-content floor: without `min-w-0` on the grid item that
  // holds it, the auto column can never size below the width the chart was last
  // drawn at, and shrinking the side panel crops every card instead of
  // reflowing them. Every direct child of the results grid carries it.
  it('lets every results grid item shrink below its content width', () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        analysis={analysis}
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    const grid = markup.slice(markup.indexOf('grid min-w-0 w-full max-w-full'));
    const items = [...grid.matchAll(/class="([^"]*profile-results:col-span-[^"]*)"/g)];

    expect(items.length).toBeGreaterThan(0);
    for (const [, className] of items) {
      expect(className).toContain('min-w-0');
    }
  });

  it('renders completeness as a bar, labelled apart from the Winning Score', () => {
    const markup = renderToStaticMarkup(<CompletenessMeter analysis={analysis} />);

    expect(markup).toContain('data-profile-completeness');
    expect(markup).toContain('Profile completeness');
    expect(markup).toContain('75%');
    expect(markup).toContain('Separate from your goal-weighted Winning Score');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="75"');
  });

  it('says completeness was unreadable rather than drawing an empty bar', () => {
    const markup = renderToStaticMarkup(
      <CompletenessMeter analysis={{ ...analysis, completenessScore: null }} />,
    );

    expect(markup).toContain('unknown fields were not treated as missing');
    expect(markup).not.toContain('role="progressbar"');
  });

  it('renders a missing-video fill but no recommendation for unreadable video', () => {
    const missingVideo = {
      ...analysis,
      priorities: [
        {
          id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa60',
          section: 'positioning' as const,
          rank: 1,
          impact: 'high' as const,
          estimatedMinutes: 15,
          recommendation: 'Add a concise introduction video.',
          reason: 'First-time clients have less profile evidence to judge you on.',
          evidence: ['Introduction video: not present.'],
          kind: 'fill' as const,
          field: null,
          itemIndex: null,
          guidance: 'Add an introduction video for the React work you target.',
          items: ['Name the client problem you solve.'],
        },
      ],
    };
    const missingMarkup = renderToStaticMarkup(
      <ProfileResults
        analysis={missingVideo}
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );
    const unreadableMarkup = renderToStaticMarkup(
      <ProfileResults
        analysis={{ ...analysis, completenessScore: null }}
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    expect(missingMarkup).toContain('Add a concise introduction video.');
    expect(missingMarkup).toContain('View recommendations');
    expect(unreadableMarkup).not.toContain('Add a concise introduction video.');
    expect(unreadableMarkup).toContain('unknown fields were not treated as missing');
  });

  it('hides the previous-analysis delta for a first analysis', () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        analysis={{ ...analysis, previousWinningScore: null }}
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    expect(markup).not.toContain('from previous analysis');
  });
});

describe('ProfileProgress', () => {
  it.each([
    { label: 'one', scores: [64] },
    { label: 'two', scores: [64, 72] },
    { label: 'many', scores: [64, 72, 78, 84] },
  ])('renders a $label-analysis trend', ({ scores }) => {
    const trend = scores.map((winningScore, index) => ({
      id: `018f6a77-4e90-7ab5-a3bf-15c8f850fa4${index}`,
      createdAt: `2026-08-${String(18 + index).padStart(2, '0')}T12:00:00.000Z`,
      winningScore,
    }));
    const markup = renderToStaticMarkup(
      <ProfileProgress
        progress={{
          latest: trend.at(-1) ?? null,
          deltaSinceFirst:
            scores.length === 1
              ? null
              : (scores.at(-1) ?? 0) - (scores[0] ?? 0),
          trend,
          sectionDeltas: [],
        }}
      />,
    );

    expect(markup).toContain(scores.join(' → '));
    expect(markup).toContain('data-score-trend');
    if (scores.length === 1) expect(markup).toContain('First analysis');
  });

  it('shows moved sections and omits unchanged sections from the delta view', () => {
    const markup = renderToStaticMarkup(
      <ProfileProgress progress={progress} />,
    );

    expect(markup).toContain('data-section-delta="overview"');
    expect(markup).toContain('58 → 82');
    expect(markup).toContain('+8 since your first analysis');
    expect(markup).not.toContain('data-section-delta="skills"');
  });
});

describe('SnapshotDiffPanel', () => {
  it('renders changed, added, and unchanged snapshot fields', () => {
    const markup = renderToStaticMarkup(
      <SnapshotDiffPanel diff={snapshotDiff} />,
    );

    expect(markup).toContain('Title changed');
    expect(markup).toContain('Overview updated');
    expect(markup).toContain('1 portfolio item added');
    expect(markup).toContain('Skills unchanged');
    // The action moved to the results bar, so it is not repeated here.
    expect(markup).not.toContain('Analyze updated profile');
  });

  it('captures exactly once when the updated-profile action runs', async () => {
    const capturedSnapshot: ProfileSnapshot = {
      source: 'upwork',
      capturedAt: '2026-08-21T12:00:00.000Z',
      completeness: UNREADABLE_PROFILE_COMPLETENESS,
      profile: {
        skills: [],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
      },
    };
    const capture = vi.fn().mockResolvedValue({ snapshot: capturedSnapshot });
    const analyze = vi.fn().mockResolvedValue(analysis);
    const onCaptured = vi.fn();

    await expect(
      runCapturedAnalysis({ analyze, capture, onCaptured }, activeGoal.id),
    ).resolves.toBe(analysis);

    expect(capture).toHaveBeenCalledOnce();
    expect(onCaptured).toHaveBeenCalledWith(capturedSnapshot);
    expect(analyze).toHaveBeenCalledOnce();
    expect(analyze).toHaveBeenCalledWith(capturedSnapshot, activeGoal.id);
  });
});

describe('ProfileBreakdown', () => {
  it('renders all eight sections in contract order regardless of API order', () => {
    const markup = renderToStaticMarkup(
      <ProfileBreakdown analysis={analysis} />,
    );
    const positions = PROFILE_SECTION_IDS.map((sectionId) =>
      markup.indexOf(`data-section-id="${sectionId}"`),
    );

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
  });

  it('makes Goal Alignment a visually promoted target-fit callout', () => {
    const markup = renderToStaticMarkup(
      <ProfileBreakdown analysis={analysis} />,
    );
    expect(markup).toContain('data-promoted="true"');
    expect(markup).toContain('order-first');
    expect(markup).toContain('data-section-id="goalAlignment"');
    expect(markup).toContain('Goal Alignment');
    expect(markup).toContain(
      'How clearly your profile supports the work you configured.',
    );
    expect(markup).toContain('aria-label="Goal Alignment score"');
    expect(markup).toContain('aria-valuenow="40"');
  });

  it('collapses every section by default', () => {
    const markup = renderToStaticMarkup(
      <ProfileBreakdown analysis={analysis} />,
    );

    expect(markup).toContain('<details');
    expect(markup).not.toMatch(/<details[^>]*\sopen/);
  });

  it('omits the disclosure for sections with no evidence to reveal', () => {
    const markup = renderToStaticMarkup(
      <ProfileBreakdown analysis={analysis} />,
    );
    const rowOf = (sectionId: string) => {
      const start = markup.indexOf(`data-section-id="${sectionId}"`);
      return markup.slice(markup.lastIndexOf('<', start), start);
    };

    // Criteria present but every evidence array empty.
    expect(rowOf('experience')).not.toContain('details');
    // No criteria at all.
    expect(rowOf('trust')).not.toContain('details');
    // Evidence present.
    expect(rowOf('overview')).toContain('details');
  });

  it('colours each score bar by tone instead of one brand green', () => {
    const markup = renderToStaticMarkup(
      <ProfileBreakdown analysis={analysis} />,
    );

    expect(markup).toContain('bg-score-weak'); // goalAlignment 40
    expect(markup).toContain('bg-warning'); // positioning 58
    expect(markup).toContain('bg-success'); // trust 91
  });

  it('labels evidence once per section rather than once per criterion', () => {
    const markup = renderToStaticMarkup(
      <ProfileBreakdown analysis={analysis} />,
    );
    const occurrences = markup.split('Evidence from your profile').length - 1;

    // overview (3 evidenced criteria), portfolio (1) and positioning (1)
    // are expandable, so the heading appears three times, not five.
    expect(occurrences).toBe(3);
    expect(markup).toContain('Value proposition');
    expect(markup).toContain('Proof');

    // The group heading must not render at the same level as the criterion
    // labels beneath it — it is a quiet eyebrow, they are content headings.
    expect(markup).toMatch(
      /uppercase[^"]*text-muted-foreground"[^>]*>\s*Evidence from your profile/,
    );
    expect(markup).toContain(
      '<p class="text-xs font-semibold text-foreground">Client focus</p>',
    );
  });
});

describe('PriorityList', () => {
  it('leads each priority with the recommendation and hides evidence behind a disclosure', () => {
    const markup = renderToStaticMarkup(
      <PriorityList
        analysis={analysis}
        onViewRecommendation={() => undefined}
      />,
    );

    expect(markup).toContain('Fix these first');
    expect(markup).toContain('Lead with the client problem you solve.');
    expect(markup).toContain('Show a target-relevant SaaS project first.');
    expect(markup).toContain('Narrow the title to the configured role.');
    expect(markup).toContain('Evidence from your profile (1)');
    expect(markup).not.toMatch(/<details[^>]*\sopen/);
  });

  it('badges a priority the previous analysis already raised, and leaves a new one unbadged', () => {
    const markup = renderToStaticMarkup(
      <PriorityList
        analysis={{
          ...analysis,
          priorities: [
            {
              ...analysis.priorities[0]!,
              previousOutcome: {
                status: 'not-implemented',
                note: 'Your overview opening is unchanged.',
              },
            },
            analysis.priorities[1]!,
          ],
        }}
        onViewRecommendation={() => undefined}
      />,
    );

    expect(markup).toContain('Still open');
    expect(markup).toContain('Your overview opening is unchanged.');
    expect(markup).toContain('data-priority-outcome="not-implemented"');
    // The second priority is new, and an absent verdict must not read as inaction.
    expect(markup.match(/data-priority-outcome/gu)).toHaveLength(1);
  });

  it('marks a repeated priority the freelancer did act on', () => {
    const markup = renderToStaticMarkup(
      <PriorityList
        analysis={{
          ...analysis,
          priorities: [
            {
              ...analysis.priorities[0]!,
              previousOutcome: {
                status: 'implemented',
                note: 'Your overview now opens with the client problem.',
              },
            },
          ],
        }}
        onViewRecommendation={() => undefined}
      />,
    );

    expect(markup).toContain('Done last time');
    expect(markup).toContain('data-priority-outcome="implemented"');
  });
});

describe('ProfileSuggestionContent', () => {
  const suggestion: ProfileSuggestion = {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa20',
    section: 'overview',
    kind: 'rewrite',
    field: 'overview',
    itemIndex: null,
    originalValue: 'I build frontend applications.',
    suggestedValue:
      'I help product teams turn complex requirements into dependable interfaces.',
    explanation: 'Leads with the client benefit without adding a credential.',
    impact: 'high',
  };

  it('renders a rewrite with Current, Recommended, and Copy as the only action', () => {
    const markup = renderToStaticMarkup(
      <ProfileSuggestionContent
        copyMessage={null}
        error={null}
        onCopy={() => undefined}
        suggestion={suggestion}
      />,
    );

    expect(markup).toContain('Current');
    expect(markup).toContain('Recommended');
    expect(markup).toContain('Why');
    expect(markup).toContain(suggestion.suggestedValue);
    expect(markup).toMatch(/<button[^>]*>.*Copy.*<\/button>/);
    // Insert ships disabled by design, so it is not offered at all.
    expect(markup).not.toContain('Insert');
  });

  it('offers no regeneration affordance, because the suggestion is saved and reused', () => {
    const markup = renderToStaticMarkup(
      <ProfileSuggestionContent
        copyMessage={null}
        error={null}
        onCopy={() => undefined}
        suggestion={suggestion}
      />,
    );

    expect(markup).toContain(suggestion.suggestedValue);
    expect(markup).not.toContain('Try another');
    expect(markup).not.toContain('Trying another');
  });

  it('renders fill guidance and items with no Copy or Insert affordance', () => {
    const fillSuggestion: ProfileSuggestion = {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa21',
      section: 'portfolio',
      kind: 'fill',
      field: 'portfolio',
      itemIndex: null,
      guidance: 'Add target-relevant project records for the work you want to win.',
      items: ['React SaaS dashboard sample project', 'B2B onboarding workflow sample'],
      explanation: 'Concrete proof supports the configured target.',
      impact: 'high',
    };
    const markup = renderToStaticMarkup(
      <ProfileSuggestionContent
        copyMessage={null}
        error={null}
        onCopy={() => undefined}
        suggestion={fillSuggestion}
      />,
    );

    expect(markup).toContain('Recommendations');
    expect(markup).toContain(fillSuggestion.guidance);
    expect(markup).toContain(fillSuggestion.items[0]);
    expect(markup).not.toMatch(/<button[^>]*>.*Copy.*<\/button>/);
    expect(markup).not.toContain('Insert');
    expect(markup).not.toContain('Recommended');
  });

  it('explains when an analytical priority resolves to a different field', () => {
    const resolvedSuggestion: ProfileSuggestion = {
      ...suggestion,
      section: 'positioning',
      field: 'title',
      originalValue: 'Frontend Developer',
      suggestedValue: 'React SaaS Frontend Developer',
    };
    const markup = renderToStaticMarkup(
      <ProfileSuggestionContent
        copyMessage={null}
        error={null}
        onCopy={() => undefined}
        suggestion={resolvedSuggestion}
      />,
    );

    expect(markup).toContain('This Positioning priority targets your');
    expect(markup).toContain('Title');
  });

  it('identifies the structured entry targeted by a rewrite', () => {
    const itemSuggestion: ProfileSuggestion = {
      ...suggestion,
      section: 'portfolio',
      field: 'portfolio',
      itemIndex: 1,
      originalValue: 'A dashboard project.',
      suggestedValue: 'A complete dashboard project description.',
    };
    const markup = renderToStaticMarkup(
      <ProfileSuggestionContent
        copyMessage={null}
        error={null}
        onCopy={() => undefined}
        suggestion={itemSuggestion}
      />,
    );

    expect(markup).toContain('This recommendation targets your');
    expect(markup).toContain('Portfolio entry 2');
  });
});

describe('actionable analyzer states', () => {
  it('renders a responsive, goal-led analysis entry surface', () => {
    const markup = renderToStaticMarkup(
      <ProfileEntry
        hasPreviousAnalysis={false}
        onAnalyze={() => undefined}
        pageError={null}
        pageState="ready"
        platformUrl="https://app.example.com"
        setup={{
          activeGoal,
          contextConfirmed: true,
          latestAnalysis: null,
          progress: {
            latest: null,
            deltaSinceFirst: null,
            trend: [],
            sectionDeltas: [],
          },
          snapshotDiff: null,
        }}
      />,
    );

    expect(markup).toContain('data-profile-entry');
    expect(markup).toContain('Your active target');
    expect(markup).toContain(activeGoal.targetRole);
    expect(markup).toContain('min-[760px]:grid-cols-');
    expect(markup).toContain('data-setup-summary="ready"');
    expect(markup).toContain('Ready to analyze');
    expect(markup).toContain('Upwork profile open');
    expect(markup).toContain('Freelancer context confirmed');
    expect(markup).not.toContain('data-requirement-state="missing"');
    expect(markup).not.toContain('disabled=""');
  });

  it.each([
    {
      code: 'NO_ACTIVE_GOAL',
      href: 'https://app.example.com/goals',
      label: 'Configure goal',
      message: 'Configure an active goal before analyzing your profile.',
    },
    {
      code: 'CONTEXT_INCOMPLETE',
      href: 'https://app.example.com/context/review',
      label: 'Review and confirm context',
      message: 'Confirm your freelancer context before analyzing your profile.',
    },
  ])(
    'renders $code with its platform action',
    ({ code, href, label, message }) => {
      const markup = renderToStaticMarkup(
        <ProfileAnalysisError
          code={code}
          message={message}
          platformUrl="https://app.example.com"
        />,
      );

      expect(markup).toContain(message);
      expect(markup).toContain(label);
      expect(markup).toContain(`href="${href}"`);
      expect(markup).not.toContain('Something went wrong');
    },
  );

  it('disables analysis with a reason on an unsupported page', () => {
    const markup = renderToStaticMarkup(
      <ProfileEntry
        hasPreviousAnalysis={false}
        onAnalyze={() => undefined}
        onRecheckPage={() => undefined}
        pageError={null}
        pageState="missing"
        platformUrl="https://app.example.com"
        setup={{
          activeGoal,
          contextConfirmed: true,
          latestAnalysis: null,
          progress: {
            latest: null,
            deltaSinceFirst: null,
            trend: [],
            sectionDeltas: [],
          },
          snapshotDiff: null,
        }}
      />,
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('data-setup-summary="missing"');
    expect(markup).toContain('1 step left before you can analyze');
    expect(markup).toContain(
      'data-requirement="profile" data-requirement-state="missing"',
    );
    expect(markup).toContain('Open your Upwork profile in this tab');
    expect(markup).toContain('Check again');
    expect(markup).toContain(
      'data-requirement="goal" data-requirement-state="ready"',
    );
    expect(markup).toContain(
      'data-requirement="context" data-requirement-state="ready"',
    );
  });

  it('counts every missing step and links each one to its fix', () => {
    const markup = renderToStaticMarkup(
      <ProfileEntry
        hasPreviousAnalysis={false}
        onAnalyze={() => undefined}
        pageError={null}
        pageState="ready"
        platformUrl="https://app.example.com"
        setup={{
          activeGoal: null,
          contextConfirmed: false,
          latestAnalysis: null,
          progress: {
            latest: null,
            deltaSinceFirst: null,
            trend: [],
            sectionDeltas: [],
          },
          snapshotDiff: null,
        }}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('2 steps left before you can analyze');
    expect(markup).toContain(
      'data-requirement="goal" data-requirement-state="missing"',
    );
    expect(markup).toContain('href="https://app.example.com/goals"');
    expect(markup).toContain(
      'data-requirement="context" data-requirement-state="missing"',
    );
    expect(markup).toContain('href="https://app.example.com/context/review"');
    expect(markup).toContain(
      'data-requirement="profile" data-requirement-state="ready"',
    );
  });

  it('keeps analysis disabled while the tab is still being checked', () => {
    const markup = renderToStaticMarkup(
      <ProfileEntry
        hasPreviousAnalysis={false}
        onAnalyze={() => undefined}
        pageError={null}
        pageState="checking"
        platformUrl="https://app.example.com"
        setup={{
          activeGoal,
          contextConfirmed: true,
          latestAnalysis: null,
          progress: {
            latest: null,
            deltaSinceFirst: null,
            trend: [],
            sectionDeltas: [],
          },
          snapshotDiff: null,
        }}
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('data-setup-summary="checking"');
    expect(markup).toContain(
      'data-requirement="profile" data-requirement-state="checking"',
    );
  });
});

describe('re-analyzing from results', () => {
  const countOf = (markup: string, text: string) =>
    markup.split(text).length - 1;

  it('keeps one action in a bar floating above the dock', () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        analysis={analysis}
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        pageState="ready"
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    expect(markup).toContain('data-reanalyze="ready"');
    expect(markup).toContain('sticky bottom-16');
    expect(countOf(markup, 'Analyze updated profile')).toBe(1);
    expect(markup).not.toContain('Open your Upwork profile to analyze it again');
  });

  it('shows a one-line hint and a disabled action off the profile page', () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        analysis={analysis}
        onAnalyzeUpdatedProfile={() => undefined}
        onRecheckPage={() => undefined}
        onViewRecommendation={() => undefined}
        pageState="missing"
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    expect(markup).toContain('data-profile-screen="results"');
    expect(markup).toContain('data-reanalyze="missing"');
    expect(markup).toContain('Open your Upwork profile to analyze it again');
    expect(markup).toContain('aria-label="Check again"');
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>.*Analyze updated profile/,
    );
  });

  it('keeps results and explains a failed read on the profile page', () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        analysis={analysis}
        captureError="Open your own Upwork profile, then try again."
        onAnalyzeUpdatedProfile={() => undefined}
        onViewRecommendation={() => undefined}
        pageState="ready"
        progress={progress}
        snapshotDiff={snapshotDiff}
      />,
    );

    expect(markup).toContain('Winning Score');
    expect(markup).toContain('Open your own Upwork profile, then try again.');
    expect(markup).not.toMatch(
      /<button[^>]*disabled=""[^>]*>.*Analyze updated profile/,
    );
  });
});
