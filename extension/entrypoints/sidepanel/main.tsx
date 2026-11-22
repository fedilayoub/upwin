import React from 'react';
import '@fontsource-variable/assistant';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConnectionProvider } from '@/features/connection/connection-context';
import {
  I18nProvider,
  initializeLocale,
} from '@/features/i18n/i18n-context';
import {
  initializeTheme,
  ThemeProvider,
} from '@/features/theme/theme-context';
import { installGlobalErrorHandlers } from '@/features/diagnostics/global-handlers';
import App from './App';
import { createSidepanelRootController } from './root-controller';
import { connectSidePanelPort } from './side-panel-port';
import './style.css';

const rootElement = document.getElementById('root');

if (!rootElement) throw new Error('Side panel root element was not found.');

// Before anything else can fail: every error from here on gets a ref and a log entry.
installGlobalErrorHandlers();

const rootController = createSidepanelRootController(rootElement);

// Tied to the document rather than the React root, so the launcher still sees
// an open panel while it is showing the connection screen.
const disconnectSidePanelPort = connectSidePanelPort();

import.meta.hot?.dispose(() => {
  disconnectSidePanelPort();
  rootController.dispose();
});

async function renderApp() {
  const [initialTheme, initialLocale] = await Promise.all([
    initializeTheme(),
    initializeLocale(),
  ]);

  if (rootController.isDisposed) return;

  rootController.render(
    <React.StrictMode>
      <I18nProvider initialLocale={initialLocale}>
        <ThemeProvider initialPreference={initialTheme}>
          <TooltipProvider delayDuration={250}>
            <ConnectionProvider>
              <App />
            </ConnectionProvider>
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </React.StrictMode>,
  );
}

void renderApp();
