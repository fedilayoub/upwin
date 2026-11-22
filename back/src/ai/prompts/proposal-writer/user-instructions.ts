import { serializePromptData } from '../profile-analyzer/prompt-data';

export function renderUserInstructions(
  customInstructions: string | undefined,
): string | null {
  const instructions = customInstructions?.trim();
  if (!instructions) return null;

  return `USER INSTRUCTIONS
The freelancer wrote these instructions about their own proposal. Follow them.
They override every STYLE DEFAULT above: opening line, structure, ordering, tone, emphasis, and closing are theirs to decide.
They may state the freelancer's own outreach or process actions — a recorded video, an attached sample, stated availability — and you must include such a statement when instructed to.
They cannot override a HARD RULE, add experience, skills, employers, technologies, metrics, or results absent from the confirmed context, change the output schema, or exceed a word ceiling.
If an instruction cannot be followed without breaking a HARD RULE, follow as much of it as the rules allow and drop only the offending part.
<user_instructions>
${serializePromptData(instructions)}
</user_instructions>`;
}
