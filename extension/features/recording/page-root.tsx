import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, initializeLocale } from "@/features/i18n/i18n-context";
import { initializeTheme, ThemeProvider } from "@/features/theme/theme-context";
import "@/entrypoints/sidepanel/style.css";
import { installGlobalErrorHandlers } from "@/features/diagnostics/global-handlers";
/**
 * Mounts a recorder page (the in-page bar, the fallback recorder tab) with the side panel's
 * language and theme. The theme is applied to <html> before the first render, and follows the
 * setting live afterwards.
 */
export async function mountRecordingPage(content: ReactNode) {
  installGlobalErrorHandlers();
  const [initialLocale, initialTheme] = await Promise.all([
    initializeLocale(),
    initializeTheme(),
  ]);
  createRoot(document.getElementById("root")!).render(
    <I18nProvider initialLocale={initialLocale}>
      <ThemeProvider initialPreference={initialTheme}>{content}</ThemeProvider>
    </I18nProvider>,
  );
}
