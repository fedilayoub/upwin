import type { z } from 'zod';
import type { AiCapability } from '../../capabilities';
import { cvExtractionSchema } from '../../schemas/cv-extraction.schema';
import { jobMatchSchema } from '../../schemas/job-match.schema';
import { profileEvaluationSchema } from '../../schemas/profile-evaluation.schema';
import { profileSuggestionSchema } from '../../schemas/profile-suggestion.schema';
import { proposalDraftSchema } from '../../schemas/proposal-draft.schema';

export const capabilityFixtures = {
  profileAnalyzer: {
    schema: profileEvaluationSchema,
    object: {
      summary:
        'The profile has credible foundations and needs sharper target positioning.',
      sections: [
        profileSection('positioning', [
          'positioningClarity',
          'clientOrientation',
          'differentiation',
        ]),
        profileSection('overview', [
          'overviewClientFocus',
          'overviewValueProposition',
          'overviewClarity',
          'overviewProof',
        ]),
        profileSection('title', [
          'titleSpecificity',
          'titleSearchability',
          'titleTargetAlignment',
        ]),
        profileSection('skills', ['skillsRelevance', 'skillsSpecialization']),
        profileSection('portfolio', ['portfolioAlignment']),
        profileSection('experience', [
          'experienceRelevance',
          'experienceAuthority',
          'experienceResults',
        ]),
        profileSection('trust', ['trustCredibility', 'trustConsistency']),
        profileSection('goalAlignment', ['goalFit', 'targetJobFit']),
      ],
      priorities: [
        {
          section: 'overview',
          recommendation: 'Lead with the specific client problem you solve.',
          reason:
            'overviewClientFocus: supplied profile detail. The current opening emphasizes the freelancer before the client outcome.',
          evidence: ['overviewClientFocus: supplied profile detail.'],
        },
        {
          section: 'portfolio',
          recommendation:
            'Publish the strongest target-aligned project from the confirmed CV.',
          reason:
            'portfolioAlignment: supplied profile detail. The published titles do not clearly name the target project type.',
          evidence: ['portfolioAlignment: supplied profile detail.'],
        },
        {
          section: 'title',
          recommendation: 'Name the target specialty directly in the title.',
          reason:
            'titleSpecificity: supplied profile detail. The title names a role but no specialty.',
          evidence: ['titleSpecificity: supplied profile detail.'],
        },
        {
          section: 'skills',
          recommendation: 'Remove skills that do not support the target work.',
          reason:
            'skillsRelevance: supplied profile detail. The list includes skills outside the target work.',
          evidence: ['skillsRelevance: supplied profile detail.'],
        },
      ],
    },
  },
  profileImprover: {
    schema: profileSuggestionSchema,
    object: {
      suggestedValue:
        'I help teams turn complex product requirements into clear, dependable digital experiences.',
      guidance:
        'Add target-relevant proof that shows the kind of product work you want to win.',
      items: [
        'React SaaS dashboard sample project',
        'TypeScript product interface sample',
      ],
      explanation:
        'Leads with the client benefit while keeping the wording grounded in the supplied profile.',
      impact: 'high',
    },
    variants: [
      {
        suggestedValue:
          'I help teams turn complex product requirements into clear, dependable digital experiences.',
        guidance:
          'Add target-relevant proof that shows the kind of product work you want to win.',
        items: [
          'React SaaS dashboard sample project',
          'TypeScript product interface sample',
        ],
        explanation:
          'Leads with the client benefit while keeping the wording grounded in the supplied profile.',
        impact: 'high',
      },
      {
        suggestedValue:
          'I turn complex product needs into polished, reliable experiences shaped around client priorities.',
        guidance:
          'Create focused proof that makes your target product work easy for clients to recognize.',
        items: [
          'SaaS dashboard sample project',
          'Responsive product workflow sample',
        ],
        explanation:
          'Uses a distinct client-focused opening without adding experience or outcome claims.',
        impact: 'high',
      },
    ],
  },
  cvExtractor: {
    schema: cvExtractionSchema,
    // Every key is present because the model-facing schema is nullable rather
    // than optional: OpenAI strict structured outputs requires each property to
    // appear in `required`. `null` is how the model says "not stated"; the
    // service strips those before domain validation.
    object: {
      experience: {
        years: 6,
        roles: [
          {
            title: 'Senior Frontend Engineer',
            company: 'Acme SaaS',
            period: 'Jan 2020 - Present',
            description: 'Built and maintained the customer dashboard.',
          },
        ],
      },
      skills: ['React', 'Next.js', 'TypeScript'],
      portfolio: [
        {
          title: 'Design system',
          description: 'A shared component library.',
          skills: ['React', 'TypeScript'],
          url: 'https://example.com/design-system',
        },
      ],
      preferences: { tone: 'professional', services: null },
      positioning: {
        targetRole: 'Senior Frontend Engineer',
        targetClients: null,
        targetIndustries: null,
        targetRate: null,
      },
    },
  },
  jobMatchEvaluator: {
    schema: jobMatchSchema,
    object: {
      summary:
        'The job is a strong match for the supplied skills and target work.',
      dimensions: [
        jobMatchDimension('skills', 'skillDepth'),
        jobMatchDimension('domain', 'domainFit'),
        jobMatchDimension('experience', 'experienceRelevance'),
        jobMatchDimension('goalAlignment', 'goalFit'),
      ],
      strengths: ['The core technical skills match the request.'],
      concerns: ['The supplied context has limited domain-specific proof.'],
    },
  },
  proposalWriter: {
    schema: proposalDraftSchema,
    object: {
      proposal:
        'I can help you build the React dashboard described in your post. My confirmed work includes TypeScript product interfaces and a SaaS dashboard project. I would begin by clarifying the highest-priority workflow and delivery constraints.',
      answers: [],
    },
    variants: [
      {
        proposal:
          'I can help you build the React dashboard described in your post. My confirmed work includes TypeScript product interfaces and a SaaS dashboard project. I would begin by clarifying the highest-priority workflow and delivery constraints.',
        answers: [],
      },
      {
        proposal:
          'Your dashboard needs a focused implementation plan. I can apply my confirmed React and TypeScript product work to the core workflow, then align the delivery details with your constraints.',
        answers: [],
      },
    ],
  },
} as const satisfies Record<
  AiCapability,
  { schema: z.ZodType; object: unknown; variants?: readonly unknown[] }
>;

function profileSection(
  id:
    | 'positioning'
    | 'overview'
    | 'title'
    | 'skills'
    | 'portfolio'
    | 'experience'
    | 'trust'
    | 'goalAlignment',
  criteria: string[],
) {
  return {
    id,
    criteria: criteria.map((name) => ({
      name,
      score: 75,
      reasoning: 'The supplied evidence meets the 75 anchor.',
      evidence: [`${name}: supplied profile detail.`],
    })),
    strengths: [],
    issues: [],
  };
}

function jobMatchDimension(
  id: 'skills' | 'domain' | 'experience' | 'goalAlignment',
  name: 'skillDepth' | 'domainFit' | 'experienceRelevance' | 'goalFit',
) {
  return {
    id,
    criteria: [
      {
        name,
        score: 75,
        reasoning: 'The supplied evidence meets the 75 anchor.',
        evidence: [`${name}: confirmed freelancer evidence.`],
      },
    ],
  };
}
