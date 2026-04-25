import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Tracks the grid's content-box dimensions via ResizeObserver.
 *
 * `flushSync` on resize is intentional — without it, a window resize that
 * adds/removes scrollbars can produce a one-frame state where the viewport
 * size is stale relative to the DOM, which manifests as flashing scrollbars
 * (the grid layout adapts to the new size only on the next React commit).
 *
 * Returns `[inlineSize, blockSize]` (i.e. `[width, height]` in horizontal
 * writing modes) so callers can compute `clientHeight = blockSize - headerH`
 * for the virtualized data area.
 */
export function useGridDimensions(
  gridRef: RefObject<HTMLDivElement | null>,
): readonly [number, number] {
  const [inlineSize, setInlineSize] = useState(1);
  const [blockSize, setBlockSize] = useState(1);

  useLayoutEffect(() => {
    // SSR / jsdom guard.
    if (typeof ResizeObserver === "undefined") return;

    const el = gridRef.current!;
    setInlineSize(el.clientWidth);
    setBlockSize(el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const size = entries[0].contentBoxSize[0];
      flushSync(() => {
        setInlineSize(size.inlineSize);
        setBlockSize(size.blockSize);
      });
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [gridRef]);

  return [inlineSize, blockSize];
}
