import type { RefObject } from "react";
import { useCallback, useSyncExternalStore } from "react";

interface ScrollState {
  readonly scrollTop: number;
  readonly scrollLeft: number;
}

const initialScrollState: ScrollState = { scrollTop: 0, scrollLeft: 0 };

// Keyed by the *ref object*, not the underlying element. The ref object is
// stable across the component's lifetime, while the element can be null
// during initial render or after unmount; keying by element would lose
// scroll state on every remount.
const scrollStateMap = new WeakMap<
  RefObject<HTMLDivElement | null>,
  ScrollState
>();

function getServerSnapshot() {
  return initialScrollState;
}

/**
 * Drives layer-2 virtualization. `useSyncExternalStore` is the right tool here
 * because the store (the DOM element's scroll position) lives outside React,
 * and we need every consumer to see the same snapshot per commit.
 *
 * Short-circuit: the subscriber recomputes scroll state and only notifies the
 * store when at least one axis changed. A no-op `scroll` event (e.g. focus
 * triggered scroll-into-view to the same position) does not re-render.
 */
export function useScrollState(
  gridRef: RefObject<HTMLDivElement | null>,
): ScrollState {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const el = gridRef.current;
      if (el === null) return () => {};

      // Prime the map with the current scroll position so the first snapshot
      // after subscribe matches reality (the element may have scrolled before
      // we attached the listener).
      setScrollState();

      function setScrollState(): boolean {
        const { scrollTop, scrollLeft } = el!;
        const prev = scrollStateMap.get(gridRef) ?? initialScrollState;
        if (prev.scrollTop === scrollTop && prev.scrollLeft === scrollLeft) {
          return false;
        }
        scrollStateMap.set(gridRef, { scrollTop, scrollLeft });
        return true;
      }

      function onScroll() {
        if (setScrollState()) onStoreChange();
      }

      el.addEventListener("scroll", onScroll);
      return () => el.removeEventListener("scroll", onScroll);
    },
    [gridRef],
  );

  const getSnapshot = useCallback((): ScrollState => {
    return scrollStateMap.get(gridRef) ?? initialScrollState;
  }, [gridRef]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
