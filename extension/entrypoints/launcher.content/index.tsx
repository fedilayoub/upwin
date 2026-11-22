import { createRoot, type Root } from 'react-dom/client';
import { isExtensionRequest } from '@/features/extension/protocol';
import {
  I18nProvider,
  initializeLocale,
} from '@/features/i18n/i18n-context';
import { LauncherBar } from '@/features/launcher/launcher-bar';
import { captureJobInPage } from '@/features/upwork/job/source';
import { captureProfileInPage } from '@/features/upwork/profile/source';
import { isSupportedJobUrl } from '@/features/upwork/job/url';
import { isSupportedOwnProfileUrl } from '@/features/upwork/profile/url';
import './style.css';

export default defineContentScript({
  cssInjectionMode: 'ui',
  // Upwork only. Content-script matches count as host permissions, and a
  // match-everything pattern gets the listing flagged for broad host access.
  // Every page the launcher can act on is an https Upwork URL (see the job and
  // profile URL guards); elsewhere the worker's page-status lookup finds no
  // receiver and falls back to `supported: false`.
  matches: ['https://www.upwork.com/*', 'https://upwork.com/*'],
  runAt: 'document_idle',

  async main(ctx) {
    const handleMessage = (
      message: unknown,
      sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      if (sender.id !== browser.runtime.id || !isExtensionRequest(message)) {
        return false;
      }

      // Forwarded by the worker when the user starts a draft or an analysis.
      // Answered here, not by injection, because launcher and side-panel
      // clicks grant no `activeTab`.
      if (message.type === 'CAPTURE_JOB') {
        sendResponse(
          captureJobInPage(
            globalThis.location.href,
            new Date(),
            message.requestId,
          ),
        );
        return true;
      }
      if (message.type === 'CAPTURE_PROFILE') {
        sendResponse(
          captureProfileInPage(
            globalThis.location.href,
            new Date(),
            message.requestId,
          ),
        );
        return true;
      }

      if (
        message.type !== 'GET_PROFILE_PAGE_STATUS' &&
        message.type !== 'GET_JOB_PAGE_STATUS'
      ) {
        return false;
      }

      sendResponse({
        supported:
          message.type === 'GET_JOB_PAGE_STATUS'
            ? isSupportedJobUrl(globalThis.location.href)
            : isSupportedOwnProfileUrl(globalThis.location.href),
      });
      return true;
    };

    browser.runtime.onMessage.addListener(handleMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(handleMessage);
    });

    const ui = await createShadowRootUi<Root>(ctx, {
      anchor: 'body',
      append: 'last',
      // Upwork listens for keystrokes across the page; what a user types into
      // the launcher is not Upwork's business.
      isolateEvents: ['keydown', 'keyup', 'keypress'],
      name: 'upwin-launcher',
      // WXT's overlay positioning writes inline styles onto the host that its
      // own `:host{all:initial !important}` reset outranks. "inline" makes WXT
      // write nothing, leaving style.css to own the layer outright.
      position: 'inline',

      onMount(container) {
        const root = createRoot(container);
        // Read once, at mount. Upwork is a single-page app, so a later in-app
        // navigation can leave either flag stale — an acceptable trade for not
        // watching the page. A stale click degrades to UNSUPPORTED_PAGE rather
        // than capturing the wrong profile or job.
        void initializeLocale({ applyToDocument: false }).then((initialLocale) => {
          if (ctx.isInvalid) return;
          root.render(
            <I18nProvider
              initialLocale={initialLocale}
              syncDocumentLanguage={false}
            >
              <LauncherBar
                isJobPage={isSupportedJobUrl(globalThis.location.href)}
                isOwnProfilePage={isSupportedOwnProfileUrl(
                  globalThis.location.href,
                )}
              />
            </I18nProvider>,
          );
        });
        return root;
      },

      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
