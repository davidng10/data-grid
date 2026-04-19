import { memo, useRef, useState } from "react";

import type { Header, Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";
import type { DropdownMenuItem } from "../../DropdownMenu";
import type { ColumnPinningState, DataGridColumnDef } from "../../types";

import { DropdownMenu } from "../../DropdownMenu";
import { useDataGridConfig } from "../../hooks/useDataGridContext";
import styles from "../../DataGrid.module.css";

type HeaderMenuProps<TRow> = {
  header: Header<TRow, unknown>;
};

function getDgColumn<TRow>(
  table: Table<TRow>,
  id: string,
): DataGridColumnDef<TRow> | undefined {
  const col = table.getColumn(id);
  const meta = col?.columnDef.meta as
    | { dataGridColumn?: DataGridColumnDef<TRow> }
    | undefined;
  return meta?.dataGridColumn;
}

function reorderMiddleInColumnOrder(
  columnOrder: string[],
  pinned: Set<string>,
  newMiddle: string[],
): string[] {
  const out = columnOrder.slice();
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    if (!pinned.has(out[i])) {
      out[i] = newMiddle[idx++];
    }
  }
  return out;
}

function currentColumnOrder<TRow>(table: Table<TRow>): string[] {
  const stateOrder = table.getState().columnOrder;
  if (stateOrder && stateOrder.length > 0) return stateOrder;
  return table.getAllLeafColumns().map((c) => c.id);
}

function currentPinning<TRow>(table: Table<TRow>): ColumnPinningState {
  const pin = table.getState().columnPinning;
  return { left: pin?.left ?? [], right: pin?.right ?? [] };
}

type Zone = "left" | "middle" | "right";

function computeZoneNeighbors<TRow>(
  table: Table<TRow>,
  id: string,
  zone: Zone,
): { prev: string | undefined; next: string | undefined } {
  if (zone === "left" || zone === "right") {
    const pin = currentPinning(table);
    const arr = zone === "left" ? pin.left : pin.right;
    const i = arr.indexOf(id);
    return { prev: i > 0 ? arr[i - 1] : undefined, next: arr[i + 1] };
  }
  const order = currentColumnOrder(table);
  const pin = currentPinning(table);
  const pinned = new Set<string>([...pin.left, ...pin.right]);
  const middle = order.filter((x) => !pinned.has(x));
  const i = middle.indexOf(id);
  return { prev: i > 0 ? middle[i - 1] : undefined, next: middle[i + 1] };
}

function moveWithinZone<TRow>(
  table: Table<TRow>,
  id: string,
  zone: Zone,
  direction: "left" | "right",
): void {
  if (zone === "left" || zone === "right") {
    const pin = currentPinning(table);
    const arr = (zone === "left" ? pin.left : pin.right).slice();
    const i = arr.indexOf(id);
    const j = direction === "left" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    table.setColumnPinning(
      zone === "left" ? { ...pin, left: arr } : { ...pin, right: arr },
    );
    return;
  }
  const order = currentColumnOrder(table);
  const pin = currentPinning(table);
  const pinned = new Set<string>([...pin.left, ...pin.right]);
  const middle = order.filter((x) => !pinned.has(x));
  const i = middle.indexOf(id);
  const j = direction === "left" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= middle.length) return;
  const nextMiddle = middle.slice();
  [nextMiddle[i], nextMiddle[j]] = [nextMiddle[j], nextMiddle[i]];
  table.setColumnOrder(reorderMiddleInColumnOrder(order, pinned, nextMiddle));
}

function HeaderMenuRender<TRow>({ header }: HeaderMenuProps<TRow>) {
  const { featureFlags } = useDataGridConfig();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (
    !featureFlags.pinning &&
    !featureFlags.reorder &&
    !featureFlags.columnVisibility
  ) {
    return null;
  }

  const table = header.getContext().table;
  const column = header.column;
  const dg = getDgColumn(table, column.id);
  const pin = column.getIsPinned();
  const zone: Zone =
    pin === "left" ? "left" : pin === "right" ? "right" : "middle";
  const { prev, next } = computeZoneNeighbors(table, column.id, zone);
  const prevDg = prev ? getDgColumn(table, prev) : undefined;
  const nextDg = next ? getDgColumn(table, next) : undefined;

  const items: DropdownMenuItem[] = [];

  if (featureFlags.pinning) {
    const fixedPinReason = dg?.fixedPin
      ? "Pin is fixed on this column"
      : undefined;
    items.push({
      label: "Pin left",
      disabled: !!dg?.fixedPin || pin === "left",
      disabledReason:
        fixedPinReason ?? (pin === "left" ? "Already pinned left" : undefined),
      onClick: () => column.pin("left"),
    });
    items.push({
      label: "Pin right",
      disabled: !!dg?.fixedPin || pin === "right",
      disabledReason:
        fixedPinReason ??
        (pin === "right" ? "Already pinned right" : undefined),
      onClick: () => column.pin("right"),
    });
    items.push({
      label: "Unpin",
      disabled: !!dg?.fixedPin || !pin,
      disabledReason: fixedPinReason ?? (!pin ? "Not pinned" : undefined),
      onClick: () => column.pin(false),
    });
  }

  if (featureFlags.reorder) {
    const selfFixedReason = dg?.fixedPosition
      ? "Column position is fixed"
      : undefined;
    items.push({
      label: "Move left",
      disabled: !!dg?.fixedPosition || !prev || !!prevDg?.fixedPosition,
      disabledReason:
        selfFixedReason ??
        (!prev
          ? "Already at the start of this zone"
          : prevDg?.fixedPosition
            ? "Blocked by a fixed-position column"
            : undefined),
      onClick: () => moveWithinZone(table, column.id, zone, "left"),
    });
    items.push({
      label: "Move right",
      disabled: !!dg?.fixedPosition || !next || !!nextDg?.fixedPosition,
      disabledReason:
        selfFixedReason ??
        (!next
          ? "Already at the end of this zone"
          : nextDg?.fixedPosition
            ? "Blocked by a fixed-position column"
            : undefined),
      onClick: () => moveWithinZone(table, column.id, zone, "right"),
    });
  }

  if (featureFlags.columnVisibility) {
    items.push({
      label: "Hide column",
      disabled: !!dg?.fixedVisible,
      disabledReason: dg?.fixedVisible ? "Always shown" : undefined,
      onClick: () => column.toggleVisibility(false),
    });
  }

  const onButtonMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };
  const onButtonClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.headerMenuButton}
        aria-label="Column menu"
        aria-expanded={open}
        onMouseDown={onButtonMouseDown}
        onClick={onButtonClick}
      >
        ⋮
      </button>
      <DropdownMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        items={items}
      />
    </>
  );
}

export const HeaderMenu = memo(HeaderMenuRender) as typeof HeaderMenuRender;
