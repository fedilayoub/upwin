import { registerRecordingController } from "../features/recording/background-controller";
import { installGlobalErrorHandlers } from "../features/diagnostics/global-handlers";
import { isRecordingMessage } from "@/features/recording/protocol";
import {
  createErrorResponse,
  isExtensionRequest,
  isJobPageStatus,
  isProfilePageStatus,
} from "@/features/extension/protocol";
import { parseSidePanelPortName } from "@/features/extension/side-panel-port";
import { isLauncherSenderUrl } from "@/features/launcher/sender";
import { profileAnalysisIntentItem } from "@/features/profile/analysis-intent";
import { proposalDraftIntentItem } from "@/features/proposals/draft-intent";
import { handleStartProposalDraftRequest } from "@/features/proposals/start-draft-request";
import {
  JobCaptureError,
  UpworkDomJobSource,
} from "@/features/upwork/job/source";
import {
  ProfileCaptureError,
  UpworkDomProfileSource,
} from "@/features/upwork/profile/source";

export default defineBackground(() => {
  // Worker errors get refs and land in the local diagnostics log too.
  installGlobalErrorHandlers(self);
  if (import.meta.env.BROWSER !== "firefox") registerRecordingController();
  // Firefox ships no side panel namespace at all, and reading through an
  // undefined one here would take the whole worker down on startup.
  const sidePanel = browser.sidePanel as typeof browser.sidePanel | undefined;
  const canOpenPanel = typeof sidePanel?.open === "function";

  // The side panel is declared with a default path and no tab-specific
  // options, so the browser gives each window one shared panel document.
  // Window identity is therefore the only thing worth tracking.
  //
  // Held ports rather than a plain flag: this worker is suspended when idle,
  // and the toggle has to answer "already open?" synchronously — awaiting a
  // stored value would spend the user gesture sidePanel.open() needs. An open
  // panel holds its port, a held port keeps the worker alive, so the map
  // cannot be lost for as long as the answer matters. Disconnect covers every
  // way a panel goes away, including the browser's own close control.
  const openPanelPorts = new Map<number, Browser.runtime.Port>();

  browser.runtime.onConnect.addListener((port) => {
    const windowId = parseSidePanelPortName(port.name);
    if (windowId === null) return;

    openPanelPorts.set(windowId, port);

    port.onDisconnect.addListener(() => {
      // A panel reopening can register before the old port reports its
      // disconnect, so only retract the entry still pointing at this port.
      if (openPanelPorts.get(windowId) === port)
        openPanelPorts.delete(windowId);
    });
  });

  // The toolbar icon opens the side panel. Synchronous for the same reason as
  // TOGGLE_SIDE_PANEL: the click's gesture does not survive an await. It never
  // closes an open panel — "click the upwin icon" is also what the recorder
  // asks for, and that click must not hide the panel. The same click grants
  // `activeTab`; the recording controller spends it when a recorder is waiting.
  browser.action?.onClicked.addListener((tab) => {
    if (!canOpenPanel || tab.id === undefined) return;
    if (openPanelPorts.has(tab.windowId)) return;
    void sidePanel.open({ tabId: tab.id }).catch(() => undefined);
  });

  browser.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id) {
        sendResponse(
          createErrorResponse(
            "unknown",
            "FORBIDDEN",
            "The message sender is not allowed.",
          ),
        );
        return true;
      }

      if (isRecordingMessage(message)) return false;

      if (!isExtensionRequest(message)) {
        sendResponse(
          createErrorResponse(
            "unknown",
            "INVALID_REQUEST",
            "The request could not be understood.",
          ),
        );
        return true;
      }

      // Read before the switch: an exhaustive switch narrows the default case
      // to never, and that arm still has to answer if the guard and this
      // switch ever fall out of step.
      const { requestId } = message;

      switch (message.type) {
        case "CAPTURE_JOB": {
          const source = new UpworkDomJobSource();

          void source
            .captureWithMetadata()
            .then((data) => {
              sendResponse({
                data,
                ok: true,
                requestId: message.requestId,
              });
            })
            .catch((error: unknown) => {
              if (error instanceof JobCaptureError) {
                sendResponse(
                  createErrorResponse(
                    message.requestId,
                    error.code,
                    error.message,
                  ),
                );
                return;
              }

              sendResponse(
                createErrorResponse(
                  message.requestId,
                  "JOB_CAPTURE_FAILED",
                  "We could not read this job. Please try again.",
                ),
              );
            });

          return true;
        }
        case "CAPTURE_PROFILE": {
          // This is the first operation after the click reaches the worker.
          // The source performs one active-tab query and one script injection;
          // it never polls, observes, navigates, scrolls, or captures again.
          const source = new UpworkDomProfileSource();

          void source
            .captureWithMetadata()
            .then((data) => {
              sendResponse({
                data,
                ok: true,
                requestId: message.requestId,
              });
            })
            .catch((error: unknown) => {
              if (error instanceof ProfileCaptureError) {
                sendResponse(
                  createErrorResponse(
                    message.requestId,
                    error.code,
                    error.message,
                  ),
                );
                return;
              }

              sendResponse(
                createErrorResponse(
                  message.requestId,
                  "PROFILE_CAPTURE_FAILED",
                  "We could not read your profile. Please try again.",
                ),
              );
            });

          return true;
        }
        case "GET_JOB_PAGE_STATUS": {
          void browser.tabs
            .query({ active: true, currentWindow: true })
            .then(([tab]) => {
              if (tab?.id === undefined) return { supported: false };
              return browser.tabs.sendMessage(tab.id, message);
            })
            .then((pageStatus: unknown) => {
              sendResponse({
                data: isJobPageStatus(pageStatus)
                  ? pageStatus
                  : { supported: false },
                ok: true,
                requestId: message.requestId,
              });
            })
            .catch(() => {
              sendResponse({
                data: { supported: false },
                ok: true,
                requestId: message.requestId,
              });
            });

          return true;
        }
        case "GET_PROFILE_PAGE_STATUS": {
          // The existing page launcher owns the current URL without requiring
          // `tabs` or a broad Upwork host permission. It reads no DOM here;
          // one-shot DOM access begins only after CAPTURE_PROFILE is clicked.
          void browser.tabs
            .query({ active: true, currentWindow: true })
            .then(([tab]) => {
              if (tab?.id === undefined) return { supported: false };
              return browser.tabs.sendMessage(tab.id, message);
            })
            .then((pageStatus: unknown) => {
              sendResponse({
                data: isProfilePageStatus(pageStatus)
                  ? pageStatus
                  : { supported: false },
                ok: true,
                requestId: message.requestId,
              });
            })
            .catch(() => {
              // A browser-owned page has no launcher receiver and is simply
              // unsupported, not an exceptional runtime failure.
              sendResponse({
                data: { supported: false },
                ok: true,
                requestId: message.requestId,
              });
            });

          return true;
        }
        case "GET_RUNTIME_STATUS":
          sendResponse({
            data: {
              connected: true,
              version: browser.runtime.getManifest().version,
            },
            ok: true,
            requestId: message.requestId,
          });
          return true;
        case "START_PROPOSAL_DRAFT":
          return handleStartProposalDraftRequest(
            message.requestId,
            sender,
            sendResponse,
            {
              canOpenPanel,
              hasOpenPanel: (windowId) => openPanelPorts.has(windowId),
              openPanel: (tabId) => sidePanel!.open({ tabId }),
              setIntent: (intent) => proposalDraftIntentItem.setValue(intent),
            },
          );
        case "START_PROFILE_ANALYSIS": {
          // Synchronous for the same reason as TOGGLE_SIDE_PANEL: the gesture
          // that authorises sidePanel.open() does not survive an await. The
          // intent write is started here but never awaited, so its promise does
          // not stand between the click and the open.
          const tab = sender.tab;

          if (tab?.id === undefined || !isLauncherSenderUrl(sender.url)) {
            sendResponse(
              createErrorResponse(
                message.requestId,
                "FORBIDDEN",
                "The analysis request did not come from a supported page.",
              ),
            );
            return true;
          }

          if (!canOpenPanel) {
            sendResponse(
              createErrorResponse(
                message.requestId,
                "RUNTIME_ERROR",
                "This browser cannot open the side panel.",
              ),
            );
            return true;
          }

          void profileAnalysisIntentItem
            .setValue({ requestedAt: Date.now() })
            .catch(() => undefined);

          // Unlike the toggle this never closes an open panel — the user asked
          // for an analysis. An already-open panel is watching the intent, so
          // opening again is unnecessary rather than harmful.
          if (!openPanelPorts.has(tab.windowId)) {
            void sidePanel.open({ tabId: tab.id }).catch(() => undefined);
          }

          sendResponse({
            data: { state: "open" },
            ok: true,
            requestId: message.requestId,
          });

          return true;
        }
        case "TOGGLE_SIDE_PANEL": {
          // Everything in this case is synchronous on purpose. Chrome only
          // honours sidePanel.open() while the click that produced this
          // message is still on the stack, and it does not survive an await —
          // not even one that resolves immediately. Anything needing I/O
          // belongs outside this listener.
          const tab = sender.tab;

          if (tab?.id === undefined || !isLauncherSenderUrl(sender.url)) {
            sendResponse(
              createErrorResponse(
                message.requestId,
                "FORBIDDEN",
                "The toggle request did not come from a supported page.",
              ),
            );
            return true;
          }

          if (!canOpenPanel) {
            sendResponse(
              createErrorResponse(
                message.requestId,
                "RUNTIME_ERROR",
                "This browser cannot open the side panel.",
              ),
            );
            return true;
          }

          const wasOpen = openPanelPorts.has(tab.windowId);

          if (wasOpen) {
            void sidePanel
              .close?.({ windowId: tab.windowId })
              ?.catch(() => undefined);
          } else {
            // The first and only statement that can consume the gesture.
            void sidePanel.open({ tabId: tab.id }).catch(() => undefined);
          }

          // Reported optimistically: onOpened and onClosed are the source of
          // truth and arrive after this response, but the launcher has already
          // been answered.
          sendResponse({
            data: { state: wasOpen ? "closed" : "open" },
            ok: true,
            requestId: message.requestId,
          });
          return true;
        }
        default:
          sendResponse(
            createErrorResponse(
              requestId,
              "INVALID_REQUEST",
              "The request type is not supported.",
            ),
          );
          return true;
      }
    },
  );
});
