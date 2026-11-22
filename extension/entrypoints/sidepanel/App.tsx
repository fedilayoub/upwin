import { VideoScreen } from "@/features/recording/ui/video-screen";
import type { VideoIntent } from "@/features/recording/ui/new-recording";
import { openRecorder } from "@/features/recording/client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectionScreen } from "@/features/connection/connection-screen";
import { useConnection } from "@/features/connection/connection-context";
import { HomeScreen } from "@/features/home/home-screen";
import { JobScreen } from "@/features/jobs/job-screen";
import type { AppSection } from "@/features/navigation/types";
import {
  isActionableAnalysisIntent,
  profileAnalysisIntentItem,
} from "@/features/profile/analysis-intent";
import { ProfileScreen } from "@/features/profile/profile-screen";
import { ProposalProvider } from "@/features/proposals/proposal-context";
import {
  consumeDraftIntent,
  isActionableDraftIntent,
  proposalDraftIntentItem,
  type ProposalDraftIntent,
} from "@/features/proposals/draft-intent";
import { ProposalScreen } from "@/features/proposals/proposal-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { AppErrorBoundary } from "@/features/diagnostics/error-boundary";

export default function App() {
  const { isConnected: isAuthenticated } = useConnection();
  const [videoIntent, setVideoIntent] = useState<VideoIntent | null>(null);
  const [activeSection, setActiveSection] = useState<AppSection>("home");
  const [analysisRequestedAt, setAnalysisRequestedAt] = useState<number | null>(
    null,
  );
  // A handled request is cleared, not kept: the profile screen remounts each
  // time its section is reopened, and a kept request would capture again.
  const clearAnalysisRequest = useCallback(() => {
    setAnalysisRequestedAt(null);
  }, []);
  const [draftIntent, setDraftIntent] = useState<ProposalDraftIntent | null>(
    null,
  );

  useEffect(() => {
    if (!isAuthenticated) setActiveSection("home");
  }, [isAuthenticated]);

  // Same cold-open bridge as profile analysis, with the job ciphertext carried
  // through so a tab switch during panel boot cannot capture a different job.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let handledRequestedAt: number | null = null;
    const consume = async (intent: unknown) => {
      if (!isActionableDraftIntent(intent, Date.now())) return;
      if (handledRequestedAt === intent.requestedAt) return;
      handledRequestedAt = intent.requestedAt;

      await consumeDraftIntent(intent, Date.now(), {
        remove: () => proposalDraftIntentItem.removeValue(),
        act: (actionable) => {
          if (cancelled) return;
          setActiveSection("job");
          setDraftIntent(actionable);
        },
      }).catch(() => undefined);
    };

    void proposalDraftIntentItem
      .getValue()
      .then(consume)
      .catch(() => undefined);
    const unwatch = proposalDraftIntentItem.watch((intent) => {
      void consume(intent);
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [isAuthenticated]);

  // The on-page Analyze shortcut leaves an intent behind rather than messaging
  // a panel that is usually not running yet. Both a stored value read at mount
  // and a later change are handled, so the shortcut behaves the same whether
  // this panel just opened or was already on screen.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const consume = async (intent: unknown) => {
      const parsed =
        intent === null || intent === undefined
          ? null
          : (intent as { requestedAt: number });
      if (!isActionableAnalysisIntent(parsed, Date.now())) return;

      // Removed before acting, so one click can only ever cause one capture.
      await profileAnalysisIntentItem.removeValue().catch(() => undefined);
      if (cancelled) return;

      setActiveSection("profile");
      setAnalysisRequestedAt(parsed.requestedAt);
    };

    void profileAnalysisIntentItem
      .getValue()
      .then(consume)
      .catch(() => undefined);
    const unwatch = profileAnalysisIntentItem.watch((intent) => {
      void consume(intent);
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return <ConnectionScreen />;

  return (
    <ProposalProvider autoDraftIntent={draftIntent}>
      <AppShell activeSection={activeSection} onNavigate={setActiveSection}>
        <AppErrorBoundary key={activeSection} section={activeSection}>
          {activeSection === "home" ? (
            <HomeScreen onNavigate={setActiveSection} />
          ) : null}
          {activeSection === "job" ? (
            <JobScreen onNavigate={setActiveSection} />
          ) : null}
          {activeSection === "proposal" ? (
            <ProposalScreen
              onRecordVideo={(intent) => {
                // Setup happens on the page. If the panel cannot reach it, the Video
                // screen explains how to open the recorder with this job attached.
                setVideoIntent(intent);
                void openRecorder(intent).then((opened) => {
                  if (opened === "needs-toolbar" || opened === "failed")
                    setActiveSection("video");
                });
              }}
            />
          ) : null}
          {activeSection === "video" ? (
            <VideoScreen intent={videoIntent} />
          ) : null}
          {activeSection === "profile" ? (
            <ProfileScreen
              autoAnalyzeRequestedAt={analysisRequestedAt}
              onAutoAnalyzeHandled={clearAnalysisRequest}
            />
          ) : null}
          {activeSection === "settings" ? <SettingsScreen /> : null}
        </AppErrorBoundary>
      </AppShell>
    </ProposalProvider>
  );
}
