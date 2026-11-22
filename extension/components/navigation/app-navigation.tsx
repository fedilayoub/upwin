import { isRecordingSupported } from "@/features/recording/support";
import {
  BriefcaseBusiness,
  FilePenLine,
  House,
  Settings,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Dock, DockItem } from "@/components/ui/dock";
import type { TranslationKey } from "@/features/i18n/dictionaries/en";
import { useI18n } from "@/features/i18n/i18n-context";
import type { AppSection } from "@/features/navigation/types";

interface NavigationItem {
  icon: LucideIcon;
  labelKey: TranslationKey;
  section: AppSection;
}

const items: NavigationItem[] = [
  { icon: House, labelKey: "nav.home", section: "home" },
  { icon: BriefcaseBusiness, labelKey: "nav.match", section: "job" },
  { icon: FilePenLine, labelKey: "nav.draft", section: "proposal" },
  { icon: UserRound, labelKey: "nav.profile", section: "profile" },
  { icon: Video, labelKey: "video.nav", section: "video" },
  { icon: Settings, labelKey: "nav.settings", section: "settings" },
];

interface AppNavigationProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
}

export function AppNavigation({
  activeSection,
  onNavigate,
}: AppNavigationProps) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("nav.primary")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] min-[300px]:px-3"
    >
      <Dock className="pointer-events-auto" distance={64} magnification={1.22}>
        {items
          .filter((item) => item.section !== "video" || isRecordingSupported())
          .map(({ icon: Icon, labelKey, section }) => {
            const isActive = activeSection === section;
            const label = t(labelKey);

            return (
              <DockItem
                active={isActive}
                key={section}
                label={label}
                onClick={() => onNavigate(section)}
              >
                <Icon className="size-4" strokeWidth={isActive ? 2.2 : 1.9} />
              </DockItem>
            );
          })}
      </Dock>
    </nav>
  );
}
