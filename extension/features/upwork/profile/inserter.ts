/**
 * Extension-owned insertion boundary. It intentionally contains semantic
 * fields only: API responses and the AI prompt never receive an Upwork selector.
 */
export interface ProfileInsertTarget {
  field: 'title' | 'overview' | 'skills' | 'portfolio' | 'employment';
  itemIndex?: number;
}

/**
 * Interface only for V1. No implementation is registered and the UI action is
 * disabled, so no DOM-writing path can execute.
 */
export interface UpworkProfileInserter {
  insert(target: ProfileInsertTarget, value: string): Promise<void>;
}
