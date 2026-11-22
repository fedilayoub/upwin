import { useI18n } from '@/features/i18n/i18n-context';
import { useResolvedTheme } from '@/features/theme/use-resolved-theme';
import { LauncherButton } from './launcher-button';
import { launcherShortcutsFor } from './shortcuts';
import { useLauncherPosition } from './use-launcher-position';

export function LauncherBar({
  isJobPage = false,
  isOwnProfilePage = false,
}: {
  isJobPage?: boolean;
  isOwnProfilePage?: boolean;
}) {
  const resolvedTheme = useResolvedTheme();
  const { locale, t } = useI18n();
  const position = useLauncherPosition();
  const shortcuts = launcherShortcutsFor({ isJobPage, isOwnProfilePage });

  return (
    // The shadow host is a fixed, click-through layer covering the viewport,
    // so pointer events are handed back only where the bar actually is.
    <div
      className="upwin-theme pointer-events-auto fixed right-0"
      data-theme={resolvedTheme}
      lang={locale}
      // Until the bar has been measured there is no pixel offset to apply, so
      // it centres itself the way it always did.
      style={
        position.top === null
          ? { top: '50%', transform: 'translateY(-50%)' }
          : { top: `${position.top}px` }
      }
    >
      <div
        aria-label={t('launcher.shortcuts')}
        aria-orientation="vertical"
        // `touch-none` keeps a touch drag from scrolling the page underneath,
        // and `select-none` stops a drag from selecting the page's text.
        className={`flex touch-none flex-col items-center gap-1 rounded-l-xl border border-r-0 border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm select-none ${
          position.dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        // Capture phase: a release that ended a drag must not reach the
        // shortcut's own click handler and open the side panel.
        onClickCapture={(event) => {
          if (!position.shouldSuppressClick()) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerCancel={position.onPointerCancel}
        onPointerDown={position.onPointerDown}
        onPointerMove={position.onPointerMove}
        onPointerUp={position.onPointerUp}
        ref={position.barRef}
        role="toolbar"
      >
        {shortcuts.map((shortcut) => (
          <LauncherButton
            key={shortcut.id}
            shortcut={{
              ...shortcut,
              label:
                shortcut.id === 'analyze-profile'
                  ? t('launcher.analyzeProfile')
                  : shortcut.id === 'draft-proposal'
                    ? t('launcher.draftProposal')
                    : shortcut.label,
            }}
          />
        ))}
      </div>
    </div>
  );
}
