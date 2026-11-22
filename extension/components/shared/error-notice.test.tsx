import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ErrorRecord } from "@/features/diagnostics/errors";
import { en } from "@/features/i18n/dictionaries/en";
import { I18nProvider } from "@/features/i18n/i18n-context";
import { ErrorNotice, errorMessageKey } from "./error-notice";

const FAILURE: ErrorRecord = {
  id: "1",
  ref: "E-7F3A2C",
  occurredAt: "2026-11-12T10:00:00.000Z",
  surface: "sidepanel",
  code: "NO_SESSION",
  httpStatus: 401,
};

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <I18nProvider initialLocale="en" syncDocumentLanguage={false}>
      {node}
    </I18nProvider>,
  );
}

describe("errorMessageKey", () => {
  it.each([
    [{ code: "NO_SESSION" }, "errors.session"],
    [{ code: "UNAUTHENTICATED", httpStatus: 401 }, "errors.session"],
    [{ code: "NETWORK_ERROR" }, "errors.network"],
    [{ code: "WORKER_NO_REPLY" }, "errors.worker"],
    [{ code: "INTERNAL_ERROR", httpStatus: 500 }, "errors.server"],
    [{ code: "HTTP_502", httpStatus: 502 }, "errors.server"],
    [{ code: "CONTEXT_INCOMPLETE", httpStatus: 422 }, null],
  ])("%o → %s", (failure, key) => {
    expect(errorMessageKey(failure)).toBe(key);
  });
});

describe("ErrorNotice", () => {
  it("replaces a generic message with what to do, and shows the ref", () => {
    const markup = render(
      <ErrorNotice
        failure={FAILURE}
        message="Something went wrong. Please try again."
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(en["errors.session"]);
    expect(markup).toContain("Ref E-7F3A2C");
    expect(markup).toContain(en["errors.copyDetails"]);
    expect(markup).toContain(en["errors.retry"]);
  });

  it("keeps the screen's message for a business error", () => {
    const markup = render(
      <ErrorNotice
        failure={{ ...FAILURE, code: "CONTEXT_INCOMPLETE", httpStatus: 422 }}
        message="Add your context first."
      />,
    );
    expect(markup).toContain("Add your context first.");
    expect(markup).not.toContain(en["errors.retry"]);
  });
});
