import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import type { Column } from "@tanstack/react-table";
import type { RefObject } from "react";

import styles from "../../DataGrid.module.css";

interface ColumnShadowOverlayProps<TRow> {
  visibleLeafColumns: Column<TRow, unknown>[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  virtualSpacerRef: RefObject<HTMLDivElement | null>;
}

/* Sticky anchor for the scroll-shadow overlays. Must be rendered as the first
 * child of scrollContainer so `sticky top: 0; left: 0` engages — a sticky
 * element at the bottom of flow never sticks at the top-left. 0×0 box, so it
 * doesn't affect layout.
 *
 * `edgeShadows` and `viewport` live here (not in the parent DataGrid) so
 * scroll-threshold crossings and resizes re-render this subtree only. */
export function ColumnShadowOverlay<TRow>({
  visibleLeafColumns,
  scrollContainerRef,
  virtualSpacerRef,
}: ColumnShadowOverlayProps<TRow>) {
  const [edgeShadows, setEdgeShadows] = useState({
    left: false,
    right: false,
  });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const { pinnedLeftWidth, pinnedRightWidth } = useMemo(() => {
    return visibleLeafColumns.reduce(
      (acc, col) => {
        const pin = col.getIsPinned();
        if (pin === "left") acc.pinnedLeftWidth += col.getSize();
        else if (pin === "right") acc.pinnedRightWidth += col.getSize();
        return acc;
      },
      { pinnedLeftWidth: 0, pinnedRightWidth: 0 },
    );
  }, [visibleLeafColumns]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const recompute = () => {
      const left = el.scrollLeft > 0;
      const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setEdgeShadows((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };

    const syncViewport = () => {
      setViewport((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight
          ? prev
          : { w: el.clientWidth, h: el.clientHeight },
      );
    };

    const onScroll = () => recompute();
    el.addEventListener("scroll", onScroll, { passive: true });
    syncViewport();
    recompute();

    // Observe the viewport (clientWidth/Height for overlay sizing) and the
    // virtual spacer (its box width tracks totalTableWidth — column add/remove
    // /resize flips the right-edge threshold without firing a scroll event).
    const ro = new ResizeObserver(() => {
      syncViewport();
      recompute();
    });
    ro.observe(el);
    const vs = virtualSpacerRef.current;
    if (vs) ro.observe(vs);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [scrollContainerRef, virtualSpacerRef]);

  return (
    <div className={styles.shadowAnchor} aria-hidden>
      <div
        className={clsx(
          styles.bodyShadowLeft,
          (!edgeShadows.left || pinnedLeftWidth === 0) &&
            styles.bodyShadowHidden,
        )}
        style={{ left: pinnedLeftWidth, height: viewport.h }}
      />
      <div
        className={clsx(
          styles.bodyShadowRight,
          (!edgeShadows.right || pinnedRightWidth === 0) &&
            styles.bodyShadowHidden,
        )}
        style={{
          left: Math.max(0, viewport.w - pinnedRightWidth - 12),
          height: viewport.h,
        }}
      />
    </div>
  );
}
