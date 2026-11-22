import type { GoalObjective } from '@/types/profile';

export interface User {
  id: string;
  name: string;
  email: string;
  goal: GoalObjective | null;
  imageUrl: string;
}

export type AuthStatus =
  | 'unauthenticated'
  | 'loading'
  | 'verifying'
  | 'authenticated'
  | 'error';
