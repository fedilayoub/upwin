import type { ProfileSectionId } from '../../profile-section';

export const rubricVersion = 'upwork-profile-v3' as const;
export const RUBRIC_ANCHOR_SCORES = [0, 25, 50, 75, 100] as const;

export type RubricAnchorScore = (typeof RUBRIC_ANCHOR_SCORES)[number];
export type DeterministicMetric =
  | 'presence'
  | 'targetKeywordCoverage'
  | 'skillsDepth'
  | 'portfolioDepth'
  | 'experienceCompleteness'
  | 'trustCompleteness';

export interface AiRubricCriterion {
  id: string;
  label: string;
  source: 'ai';
  weight: number;
  anchors: Record<RubricAnchorScore, string>;
}

export interface DeterministicRubricCriterion {
  id: string;
  label: string;
  source: 'deterministic';
  weight: number;
  metric: DeterministicMetric;
}

export type RubricCriterion = AiRubricCriterion | DeterministicRubricCriterion;

export interface ProfileSectionRubric {
  label: string;
  criteria: readonly RubricCriterion[];
}

const anchored = (
  id: string,
  label: string,
  weight: number,
  anchors: Record<RubricAnchorScore, string>,
): AiRubricCriterion => ({ id, label, source: 'ai', weight, anchors });

const deterministic = (
  id: string,
  label: string,
  weight: number,
  metric: DeterministicMetric,
): DeterministicRubricCriterion => ({
  id,
  label,
  source: 'deterministic',
  weight,
  metric,
});

export const profileRubricV1 = {
  positioning: {
    label: 'Positioning',
    criteria: [
      deterministic(
        'positioningKeywords',
        'Target keyword coverage',
        0.15,
        'targetKeywordCoverage',
      ),
      anchored('positioningClarity', 'Positioning clarity', 0.3, {
        0: 'Names no service, deliverable, audience, problem, or outcome.',
        25: 'Names a service or capability, but no audience, client problem, deliverable, or outcome.',
        50: 'Names a service and either an audience or specialty, but no specific client problem or concrete deliverable.',
        75: 'Names a specific client type, the problem solved, and a concrete deliverable or outcome.',
        100: 'Meets the 75 anchor and the profile supplies a project or work-history example that substantiates the deliverable or outcome.',
      }),
      anchored('clientOrientation', 'Client orientation', 0.3, {
        0: 'Contains no client, audience, client problem, benefit, or outcome reference.',
        25: 'Names a client or audience, but the claims describe only freelancer credentials, tools, or tasks.',
        50: 'Names either a client problem or a client outcome, but not both, and gives no concrete deliverable.',
        75: 'Names the client problem, the intended outcome, and the deliverable or action that connects them.',
        100: 'Meets the 75 anchor and cites a supplied project, role, or result that demonstrates the claimed client outcome.',
      }),
      anchored('differentiation', 'Differentiation', 0.25, {
        0: 'Names no specialty, domain, method, audience, or proof that distinguishes the service.',
        25: 'Uses only generic claims such as quality, passion, reliability, or experience.',
        50: 'Names one specific specialty, domain, audience, or working method, but supplies no supporting profile fact.',
        75: 'Names a specialty or method and supports it with one matching project, role, certification, or result.',
        100: 'Meets the 75 anchor and supplies at least two independent matching proof points, including a concrete outcome or constraint handled.',
      }),
    ],
  },
  overview: {
    label: 'Overview',
    criteria: [
      deterministic('overviewPresence', 'Overview presence', 0.1, 'presence'),
      deterministic(
        'overviewKeywords',
        'Target keyword coverage',
        0.15,
        'targetKeywordCoverage',
      ),
      anchored('overviewClientFocus', 'Client focus', 0.2, {
        0: 'Contains no client, audience, client problem, benefit, or outcome reference.',
        25: 'Names an audience at most once; the remaining text lists freelancer traits, tools, or history.',
        50: 'Names a client problem or outcome, but does not connect it to both a service and a concrete deliverable.',
        75: 'The opening names a target client problem, then connects the service to a deliverable or outcome for that client.',
        100: 'Meets the 75 anchor and supports the client outcome with a supplied project, role, or quantified result.',
      }),
      anchored('overviewValueProposition', 'Value proposition', 0.2, {
        0: 'Names no service, deliverable, problem, benefit, or outcome.',
        25: 'Lists skills or tasks without saying what the client receives or improves.',
        50: 'Names a service and a deliverable or broad benefit, but no specific audience or client problem.',
        75: 'Names the target client, their problem, the service, and a concrete deliverable or outcome.',
        100: 'Meets the 75 anchor and ties the outcome to a supplied project, role, metric, or other inspectable proof.',
      }),
      anchored('overviewClarity', 'Clarity', 0.15, {
        0: 'Contains fragments or contradictions that prevent identification of the offered service.',
        25: 'The service can be identified, but repeated ideas, sentence fragments, or one unbroken block obscure it.',
        50: 'Uses complete sentences and a recognizable sequence, but the opening delays the service or multiple paragraphs repeat the same claim.',
        75: 'States the service in the opening, separates distinct ideas into short paragraphs or a list, and contains no repeated claim.',
        100: 'Meets the 75 anchor and every paragraph has one identifiable purpose: client need, service, proof, or next step.',
      }),
      anchored('overviewProof', 'Proof', 0.2, {
        0: 'Contains no named project, employer, deliverable, responsibility, result, or credential.',
        25: 'Makes quality or experience claims without naming where, what, or what changed.',
        50: 'Names a relevant project, employer, tool, or credential, but gives no specific contribution or result.',
        75: 'Names a relevant project or role, the freelancer contribution, and the resulting deliverable or client benefit.',
        100: 'Meets the 75 anchor and includes a quantified result or an independently inspectable deliverable tied to the contribution.',
      }),
    ],
  },
  title: {
    label: 'Title',
    criteria: [
      deterministic('titlePresence', 'Title presence', 0.15, 'presence'),
      anchored('titleSpecificity', 'Specificity', 0.3, {
        0: 'Contains no recognizable role, service, specialty, audience, or outcome.',
        25: 'Contains only a broad role or service such as developer, designer, or marketer.',
        50: 'Names a role plus one technology, domain, audience, deliverable, or outcome.',
        75: 'Names the role plus at least two of: specialty, target client, concrete deliverable, or client outcome.',
        100: 'Meets the 75 anchor and every specialization claim is substantiated elsewhere in the supplied profile.',
      }),
      anchored('titleSearchability', 'Searchability', 0.25, {
        0: 'Contains none of the supplied target role, preferred skills, project types, or equivalent terms.',
        25: 'Contains one broad field term, but not the supplied target role or a preferred skill.',
        50: 'Contains the supplied target role or one preferred skill, but not both.',
        75: 'Contains the supplied target role and at least one preferred skill, specialty, or project-type term.',
        100: 'Meets the 75 anchor, adds a second supplied specialty term, and contains no unrelated role or keyword list.',
      }),
      anchored('titleTargetAlignment', 'Target alignment', 0.3, {
        0: 'Names a role or service outside the supplied target field.',
        25: 'Shares only one broad field term with the supplied target role.',
        50: 'Names the target role, but none of the supplied preferred skills, client types, or project types.',
        75: 'Names the target role and at least two supplied target dimensions: skill, client type, or project type.',
        100: 'Meets the 75 anchor and the supplied portfolio or work history demonstrates the same role and target dimensions.',
      }),
    ],
  },
  skills: {
    label: 'Skills',
    criteria: [
      deterministic('skillsDepth', 'Skill-set depth', 0.2, 'skillsDepth'),
      deterministic(
        'skillsKeywords',
        'Target skill coverage',
        0.25,
        'targetKeywordCoverage',
      ),
      anchored('skillsRelevance', 'Relevance', 0.3, {
        0: 'No listed skill supports the supplied target role, project types, or preferred skills.',
        25: 'Fewer than one quarter of listed skills support the supplied target work.',
        50: 'Between one quarter and less than three fifths of listed skills support the supplied target work.',
        75: 'At least three fifths but not all listed skills support the supplied target work.',
        100: 'Every listed skill supports the supplied target work and each core skill appears in a supplied project, role, or credential.',
      }),
      anchored('skillsSpecialization', 'Specialization coherence', 0.25, {
        0: 'No two listed skills combine into a recognizable service or workflow.',
        25: 'The list contains multiple unrelated skill clusters and no cluster contains more than two supporting skills.',
        50: 'One service cluster contains at least three skills, but at least one third of the list belongs to unrelated clusters.',
        75: 'At least three quarters of the list supports one specialty and covers its core delivery workflow.',
        100: 'Every listed skill supports one specialty and the supplied profile contains work evidence for its core skills.',
      }),
    ],
  },
  portfolio: {
    label: 'Portfolio',
    criteria: [
      deterministic('portfolioDepth', 'Portfolio depth', 0.4, 'portfolioDepth'),
      anchored('portfolioAlignment', 'Target alignment', 0.6, {
        0: 'No published project title shares the supplied target role, preferred skills, client types, or project types.',
        25: 'At least one published title shares one broad target field or skill term, but no title names the target project type.',
        50: 'At least one published title names the target role or project type, but fewer than half of the titles do.',
        75: 'At least half of the published titles name the target role, a preferred skill, or the target project type, and one title directly names the target project type.',
        100: 'Every published title clearly names the target role, a preferred skill, or the target project type, and together the titles cover more than one supplied target dimension.',
      }),
    ],
  },
  experience: {
    label: 'Experience',
    criteria: [
      deterministic(
        'experienceCompleteness',
        'Experience completeness',
        0.2,
        'experienceCompleteness',
      ),
      anchored('experienceRelevance', 'Relevance', 0.3, {
        0: 'No role or education entry shares the supplied target field, role, skill, or project type.',
        25: 'An entry shares one broad field term, but states no target-relevant responsibility or deliverable.',
        50: 'At least one entry matches the target role or a preferred skill, but gives no matching client, project type, or result.',
        75: 'At least one entry matches the target role and names a target-relevant responsibility or deliverable.',
        100: 'At least two entries form a continuous target-relevant track record and include a matching responsibility plus result.',
      }),
      anchored('experienceAuthority', 'Authority', 0.25, {
        0: 'Contains no role, responsibility, owned deliverable, decision, or leadership signal.',
        25: 'Lists titles or assigned tasks, but no owned component, project, decision, or stakeholder responsibility.',
        50: 'Names ownership of a deliverable, component, or project, but no decisions, scope, team, or stakeholder responsibility.',
        75: 'Names owned scope and at least one decision, stakeholder, team, or delivery responsibility.',
        100: 'Shows repeated ownership across roles and ties that ownership to outcomes, standards, mentoring, or organization-level decisions.',
      }),
      anchored('experienceResults', 'Result evidence', 0.25, {
        0: 'No contribution, deliverable, change, result, or client benefit is described.',
        25: 'Lists duties or responsibilities without naming what was delivered or changed.',
        50: 'Names a completed deliverable or contribution, but no resulting user, client, system, or business change.',
        75: 'Connects a contribution to a specific result such as time saved, risk removed, capability added, or client outcome.',
        100: 'Meets the 75 anchor in more than one entry and quantifies at least one result.',
      }),
    ],
  },
  trust: {
    label: 'Trust',
    criteria: [
      deterministic(
        'trustCompleteness',
        'Trust-signal completeness',
        0.3,
        'trustCompleteness',
      ),
      anchored('trustCredibility', 'Credibility', 0.4, {
        0: 'The supplied sections contradict a core claim or contain no identifiable proof source.',
        25: 'Contains claims about quality or expertise, but no named project, role, credential, client result, or inspectable work.',
        50: 'Contains one identifiable proof source that supports a core service claim.',
        75: 'Contains at least two independent proof sources that support the same service claim, such as a role plus a project or credential.',
        100: 'Contains at least three mutually reinforcing proof sources, including a quantified result or independently inspectable work artifact.',
      }),
      anchored('trustConsistency', 'Consistency', 0.3, {
        0: 'The title, overview, or experience makes a claim directly contradicted by another supplied section or the confirmed context.',
        25: 'The title and overview target different services, or neither is supported by skills, projects, or experience.',
        50: 'The title and overview target the same broad field, but at least two proof sections point to unrelated work.',
        75: 'The title, overview, skills, and at least one project or experience entry support the same target service.',
        100: 'Every populated section supports the same target service and no populated section introduces an unrelated or conflicting professional direction.',
      }),
    ],
  },
  goalAlignment: {
    label: 'Goal alignment',
    criteria: [
      deterministic(
        'goalKeywords',
        'Target keyword coverage',
        0.25,
        'targetKeywordCoverage',
      ),
      anchored('goalFit', 'Goal fit', 0.4, {
        0: 'No supplied profile section supports the stated objective, target role, or target audience.',
        25: 'One isolated title, skill, project, or role supports the objective, but the title and overview do not.',
        50: 'The title or overview names the target role and at least one proof section supports it, but most sections are not shaped around the objective.',
        75: 'The title and overview address the objective, and a majority of skills, projects, or experience entries reinforce it.',
        100: 'Every populated major section reinforces the objective and includes proof addressing the goal-specific constraint, audience, or value level.',
      }),
      anchored('targetJobFit', 'Target-job fit', 0.35, {
        0: 'Shares none of the supplied target role, preferred skills, client types, or project types.',
        25: 'Shares one broad field term, but not the target role or a preferred skill.',
        50: 'Matches the target role and at least one preferred skill, but not the supplied client or project type.',
        75: 'Matches the target role, preferred skills, and at least one supplied client type or project type.',
        100: 'Matches all supplied target dimensions and substantiates each with a project, role, result, or credential in the profile.',
      }),
    ],
  },
} as const satisfies Record<ProfileSectionId, ProfileSectionRubric>;
