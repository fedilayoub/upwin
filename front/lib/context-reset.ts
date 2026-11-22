export const CONTEXT_DELETE_CONFIRMATION_FIELD = 'contextDeletionConfirmation';
export const CONTEXT_DELETE_CONFIRMATION_VALUE = 'delete-freelancer-context';

export function isContextDeletionConfirmed(formData: FormData): boolean {
  return (
    formData.get(CONTEXT_DELETE_CONFIRMATION_FIELD) ===
    CONTEXT_DELETE_CONFIRMATION_VALUE
  );
}
