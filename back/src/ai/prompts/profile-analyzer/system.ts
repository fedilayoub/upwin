import { SYSTEM_INVARIANTS } from './analyzer-invariants';

export function renderSystemPrompt(persona: string): string {
  return [persona, ...SYSTEM_INVARIANTS].join(' ');
}
