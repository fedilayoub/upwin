import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { ErrorNotice } from "@/components/shared/error-notice";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import { reportError } from "./error-log";
import type { ErrorRecord } from "./errors";

interface BoundaryProps {
  section: string;
  children: ReactNode;
}

/**
 * A render crash used to blank the whole panel. Now it is logged, shown with
 * a ref, and the rest of the panel (navigation, other sections) keeps working.
 */
interface BoundaryState {
  crashed: boolean;
  failure: ErrorRecord | null;
}

export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { crashed: false, failure: null };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { crashed: true };
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo) {
    this.setState({
      failure: reportError({
        error,
        code: "RENDER_CRASH",
        operation: `ui.${this.props.section}`,
      }),
    });
  }

  override render() {
    if (!this.state.crashed) return this.props.children;
    return this.state.failure ? (
      <CrashNotice failure={this.state.failure} />
    ) : null;
  }
}

function CrashNotice({ failure }: { failure: ErrorRecord }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <ErrorNotice failure={failure} message={t("errors.crashed")} />
      <Button size="sm" variant="outline" onClick={() => location.reload()}>
        <RotateCw className="size-3.5" aria-hidden />
        {t("errors.reload")}
      </Button>
    </div>
  );
}
