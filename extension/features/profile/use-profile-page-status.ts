import {
  isActiveTabNavigation,
  usePageStatus,
  type PageState,
} from '@/features/extension/use-page-status';
import { profileService } from '@/services/profile';

export { isActiveTabNavigation };
export type ProfilePageState = PageState;

/**
 * Whether the active tab is the user's own Upwork profile, kept current while
 * the analyzer is on screen. See `usePageStatus`.
 */
export function useProfilePageStatus() {
  return usePageStatus(profileService.getPageStatus);
}
