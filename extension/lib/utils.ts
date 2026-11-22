import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGoal(goal: import('@/types/profile').GoalObjective): string {
  const labels: Record<import('@/types/profile').GoalObjective, string> = {
    'first-client': 'Get my first client',
    'more-clients': 'Win more clients',
    'more-responses': 'Increase proposal response rate',
    'higher-paying-projects': 'Get higher-paying projects',
    scale: 'Scale my freelancing business',
  };

  return labels[goal];
}
