import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

type ManagedRoot = Pick<Root, 'render' | 'unmount'>;
type CreateRoot = (container: Element | DocumentFragment) => ManagedRoot;
interface RootRegistry {
  container: Element;
  generation: number;
  root: ManagedRoot | null;
}
interface RootRegistryHost {
  __UPWIN_SIDEPANEL_ROOT__?: RootRegistry;
}

export interface SidepanelRootController {
  readonly isDisposed: boolean;
  dispose: () => void;
  render: (node: ReactNode) => void;
}

export function createSidepanelRootController(
  container: Element,
  createRootImplementation: CreateRoot = createRoot,
  registryHost: RootRegistryHost = globalThis as RootRegistryHost,
): SidepanelRootController {
  let registry = registryHost.__UPWIN_SIDEPANEL_ROOT__;

  if (!registry || registry.container !== container) {
    registry?.root?.unmount();

    let cleanContainer = container;

    // Migrate pages mounted by older development code that did not keep a
    // global root reference. Replacing the occupied container avoids calling
    // createRoot() on a React-owned node and immediately removes duplicate UI.
    if (!registry && container.hasChildNodes() && container.parentNode) {
      cleanContainer = container.cloneNode(false) as Element;
      container.replaceWith(cleanContainer);
    }

    registry = {
      container: cleanContainer,
      generation: 0,
      root: null,
    };
    registryHost.__UPWIN_SIDEPANEL_ROOT__ = registry;
  }

  const generation = ++registry.generation;
  let disposed = false;

  return {
    get isDisposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
    },
    render(node) {
      if (disposed || registry.generation !== generation) return;

      registry.root ??= createRootImplementation(registry.container);
      registry.root.render(node);
    },
  };
}
