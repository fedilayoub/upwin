import { describe, expect, it, vi } from 'vitest';
import { createSidepanelRootController } from './root-controller';

describe('createSidepanelRootController', () => {
  it('cancels a pending asynchronous render after HMR disposal', () => {
    const render = vi.fn();
    const unmount = vi.fn();
    const createRoot = vi.fn(() => ({ render, unmount }));
    const registryHost = {};
    const controller = createSidepanelRootController(
      { hasChildNodes: () => false } as unknown as Element,
      createRoot,
      registryHost,
    );

    controller.dispose();
    controller.render(null);

    expect(controller.isDisposed).toBe(true);
    expect(createRoot).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    expect(unmount).not.toHaveBeenCalled();
  });

  it('reuses one root when the entry module is evaluated again', () => {
    const container = {
      hasChildNodes: () => false,
    } as unknown as Element;
    const registryHost = {};
    const render = vi.fn();
    const unmount = vi.fn();
    const createRoot = vi.fn(() => ({ render, unmount }));
    const oldController = createSidepanelRootController(
      container,
      createRoot,
      registryHost,
    );
    const newController = createSidepanelRootController(
      container,
      createRoot,
      registryHost,
    );

    oldController.render('stale tree');
    newController.render('current tree');

    expect(createRoot).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith('current tree');
    expect(unmount).not.toHaveBeenCalled();
  });

  it('replaces an occupied legacy container before creating the managed root', () => {
    const replacement = { hasChildNodes: () => false } as unknown as Element;
    const replaceWith = vi.fn();
    const container = {
      cloneNode: () => replacement,
      hasChildNodes: () => true,
      parentNode: {},
      replaceWith,
    } as unknown as Element;
    const createRoot = vi.fn(() => ({
      render: vi.fn(),
      unmount: vi.fn(),
    }));
    const controller = createSidepanelRootController(
      container,
      createRoot,
      {},
    );

    controller.render(null);

    expect(replaceWith).toHaveBeenCalledWith(replacement);
    expect(createRoot).toHaveBeenCalledWith(replacement);
  });
});
