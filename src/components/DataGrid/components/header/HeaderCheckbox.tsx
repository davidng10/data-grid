import { useEffect, useRef } from "react";

import type { MouseEvent } from "react";

import { useHeaderSelectionContext } from "../../hooks/useHeaderSelectionContext";
import styles from "../../DataGrid.module.css";

// Header checkbox for the injected __select__ column. Tri-state — the
// `indeterminate` DOM property (not an HTML attr) reflects "some but not all
// rows on the current page selected".
export function HeaderCheckbox() {
  const ctx = useHeaderSelectionContext();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.indeterminate = ctx?.state === "some";
  }, [ctx?.state]);

  if (!ctx) return null;

  const onClick = (e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    ctx.toggleAll();
    e.preventDefault();
  };

  return (
    <input
      ref={ref}
      type="checkbox"
      className={styles.rowCheckbox}
      checked={ctx.state === "all"}
      onClick={onClick}
      onChange={() => {}}
      aria-label="Select all rows on this page"
    />
  );
}
