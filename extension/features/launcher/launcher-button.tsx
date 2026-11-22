import { BrandThinkingOrb } from '@/components/shared/brand-thinking-orb';
import { Button } from '@/components/ui/button';
import type {
  LauncherShortcut,
  LauncherShortcutVisual,
} from './shortcuts';

export function LauncherButton({ shortcut }: { shortcut: LauncherShortcut }) {
  return (
    <div className="group relative flex items-center">
      <Button
        aria-label={shortcut.label}
        // Smaller than the shared `icon` size: this one sits on top of
        // someone else's page, so it stays as small as it can while still
        // being a comfortable click target.
        className="size-8 cursor-pointer"
        // Nothing runs before this call. Opening the side panel spends the
        // user gesture this click is carrying, and reading state or awaiting
        // anything first would discard it.
        onClick={() => {
          void shortcut.run().catch(() => undefined);
        }}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ShortcutVisual visual={shortcut.visual} />
      </Button>

      {/* A plain label rather than the shared Tooltip: that one portals to
          document.body, which is outside this shadow root and therefore
          outside every style the launcher ships with. Anchored above the
          button and flush to its right edge — the bar hugs the viewport edge,
          so a centred label would run off-screen. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-full mb-2 rounded-md bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {shortcut.label}
      </span>
    </div>
  );
}

function ShortcutVisual({ visual }: { visual: LauncherShortcutVisual }) {
  if (visual.kind === 'orb') {
    return (
      <span aria-hidden="true">
        <BrandThinkingOrb
          size={20}
          state={visual.state}
          style={{ height: 24, width: 24 }}
        />
      </span>
    );
  }

  const Icon = visual.icon;
  return <Icon className="size-[15px]" strokeWidth={1.9} />;
}
