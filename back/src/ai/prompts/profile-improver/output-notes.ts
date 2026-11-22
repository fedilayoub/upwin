import { UPWORK_TITLE_MAX_LENGTH } from '../../../profile/suggestions/profile-suggestion.schema';
import type { ProfileImproverPromptData } from './prompt-data';

export function renderProfileImproverOutputNotes({
  originalValue,
  context,
  rankedMissingPortfolioProjects,
  section,
  style,
  target,
}: Pick<
  ProfileImproverPromptData,
  | 'context'
  | 'originalValue'
  | 'rankedMissingPortfolioProjects'
  | 'section'
  | 'style'
  | 'target'
>): string {
  const notes = [
    'OUTPUT NOTES',
    `Analytical priority: ${section}`,
    `Backend-selected field: ${target.field}`,
    `Backend-selected item index: ${target.itemIndex ?? 'none'}`,
    `Backend-selected suggestion kind: ${target.kind}`,
    `Rewrite style: ${style ?? 'natural professional'}`,
    'The style changes wording only; it never changes or adds facts.',
    'Do not choose a different field, item index, or suggestion kind.',
  ];

  if (target.kind === 'rewrite') {
    notes.push(
      `Current target length: ${originalValue?.length ?? 0} characters.`,
      'suggestedValue must be a complete, copy-ready replacement for the selected field or item description.',
      'Do not return only a new opening sentence. Preserve supported details from the current value.',
      'Set guidance and items to null.',
    );

    if (target.field === 'title') {
      notes.push(
        `Upwork limits the profile title to ${UPWORK_TITLE_MAX_LENGTH} characters. suggestedValue must be at most ${UPWORK_TITLE_MAX_LENGTH} characters including spaces.`,
        'Count the characters before answering. A longer title cannot be saved on Upwork, so drop words rather than exceed the limit.',
        'Prefer the target role and the client or specialism it serves. Do not pad with a tagline.',
      );
    } else {
      // The user pastes suggestedValue straight into an Upwork text box,
      // which keeps line breaks but renders no Markdown. A single run-on
      // paragraph forced them to re-format the whole rewrite by hand.
      notes.push(
        'Format suggestedValue as ready-to-paste plain text with real line breaks (\\n).',
        'Separate paragraphs with one blank line. Put every bullet or list item on its own line.',
        'Keep the section structure of the current value: its paragraphs, short headings, and bullet lists, with the same bullet character. If the current value is one dense block, break it into short paragraphs and use bullets where it lists things.',
        'Never merge the text into one paragraph. Never use Markdown: no #, no **bold**, no _italics_.',
      );
    }
  } else if (target.field === 'skills') {
    // A skill tag IS a technology name, so the generic fill notes must not be
    // used here: telling the model to write "concrete future work" and to avoid
    // naming "technologies used" is what produced prose items such as
    // "Add React to showcase your dashboard work", which the domain rules then
    // rejected outright.
    notes.push(
      'Set suggestedValue to null. There is no safe text field to copy.',
      'guidance must explain which kinds of skill tags are missing for the configured goal and why they matter.',
      'Every item must be one Upwork skill-tag label and nothing else: the bare name of a skill, tool, or technology.',
      'An item is at most five words, contains no sentence punctuation, and never starts with a verb such as add, include, learn, or showcase.',
      'Good items: "React", "Next.js", "Tailwind CSS", "SaaS dashboard design".',
      'Bad items: "Add React to your skills.", "Learn TypeScript", "Showcase your dashboard experience".',
      'Put the advice in guidance and the explanation. Never put it in an item.',
      'Only propose tags the profile and confirmed context already support. Do not invent expertise.',
    );
  } else {
    notes.push(
      'Set suggestedValue to null. There is no safe text field to copy.',
      'guidance must explain what the user should create or add and why it supports the configured goal.',
      'items must be concrete future work or additions, never claims that the work is already complete.',
      'Do not refer to results achieved, technologies used, features developed, roles performed, or other unverified past work.',
      'Use imperative or noun-phrase items such as projects to add, not past-tense achievements.',
    );

    if (target.field === 'portfolio') {
      const missingTitles = rankedMissingPortfolioProjects.map(
        (project) => project.title,
      );

      if (missingTitles.length > 0) {
        notes.push(
          'The backend compared confirmed CV projects with published Upwork portfolio titles and ranked the missing projects for this goal.',
          `Allowed project titles, ranked best-first for this goal: ${JSON.stringify(missingTitles)}`,
          'Every item must be one of those titles, copied exactly. Recommend as many as genuinely help, best-first. Never add, rename, paraphrase, or describe a project.',
          'guidance must explain why publishing these named projects supports the configured goal.',
          'Never write a portfolio description or present CV project prose as existing Upwork profile text.',
        );
      } else if (context.portfolio.length === 0) {
        notes.push(
          'The confirmed CV context contains no projects to select. Do not repeat that absence in the output.',
          'Recommend brand-new sample or concept projects to build honestly from scratch.',
          "Do not recommend case studies, portfolio entries, descriptions of the user's work, results, roles, or other past artifacts.",
        );
      } else {
        // The schema requires at least one item, so this branch must leave the
        // model something truthful to say. "Produce nothing" is unsatisfiable
        // and rejected every request outright.
        notes.push(
          'Every titled project in the confirmed CV context is already published, so the portfolio is in good shape and there is no gap to close.',
          'Recommend brand-new sample or concept projects to build next, chosen to make the configured target work more visible.',
          "Do not rename or re-describe a published project, and do not present a concept as existing work the user has already done.",
        );
      }
    }
  }

  notes.push('explanation must briefly say why this action is stronger.');
  return notes.join('\n');
}
