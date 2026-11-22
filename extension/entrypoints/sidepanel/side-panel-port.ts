import { createSidePanelPortName } from '@/features/extension/side-panel-port';

/**
 * Announces this panel to the background worker for as long as its document
 * lives, so the launcher's toggle knows a panel is already open here.
 *
 * Runs once per panel document rather than per React root: the panel must be
 * closable even while it is showing a configuration error or the signed-out
 * screen, neither of which mounts the app.
 */
export function connectSidePanelPort(): () => void {
  let disposed = false;
  let port: ReturnType<typeof browser.runtime.connect> | undefined;

  void (async () => {
    try {
      // A side panel is not a tab, so the worker cannot learn which window
      // this document belongs to from the port's sender. The panel is the only
      // context that knows, so it says so in the port name.
      const { id: windowId } = await browser.windows.getCurrent();
      if (disposed || windowId === undefined) return;

      port = browser.runtime.connect({
        name: createSidePanelPortName(windowId),
      });

      // Reading lastError marks an extension reload as handled rather than an
      // unchecked failure.
      port.onDisconnect.addListener(() => void browser.runtime.lastError);
    } catch {
      // The extension was reloaded underneath this document; it is already
      // gone and nothing here can recover it.
    }
  })();

  return () => {
    disposed = true;
    port?.disconnect();
  };
}
