/**
 * Shared shape for `useActionState` in the goal and onboarding forms.
 *
 * This lives outside the `'use server'` module on purpose: Next.js requires
 * every export of a `'use server'` file to be an async function, so exporting
 * the initial-state object from `actions.ts` fails at module evaluation with
 * "A 'use server' file can only export async functions, found object." The
 * interface alone would have been fine — types are erased — but the const is not.
 */
export interface FormActionState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const INITIAL_FORM_ACTION_STATE: FormActionState = { status: 'idle' };
