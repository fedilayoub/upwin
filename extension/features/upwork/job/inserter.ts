export interface ProposalInsertTarget {
  block: 'proposal' | 'answer';
  position?: number;
}

/**
 * Type-only boundary for a possible future insert feature. Nothing registers
 * an implementation, and no code writes to the page.
 */
export interface UpworkProposalInserter {
  insert(target: ProposalInsertTarget, text: string): Promise<void>;
  isAvailable(target: ProposalInsertTarget): Promise<boolean>;
}
