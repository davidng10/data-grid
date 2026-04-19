import { useCallback, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableHeaderCell } from "./SortableHeaderCell";

import type { CollisionDetection, DragEndEvent } from "@dnd-kit/core";
import type { Header, Table } from "@tanstack/react-table";
import type { ColumnPinningState, DataGridColumnDef } from "../../types";

import styles from "../../DataGrid.module.css";

type Props<TRow> = {
  headers: Header<TRow, unknown>[];
  height: number;
  totalWidth: number;
};

function getDg<TRow>(
  table: Table<TRow>,
  id: string,
): DataGridColumnDef<TRow> | undefined {
  const col = table.getColumn(id);
  const meta = col?.columnDef.meta as
    | { dataGridColumn?: DataGridColumnDef<TRow> }
    | undefined;
  return meta?.dataGridColumn;
}

function currentOrder<TRow>(table: Table<TRow>): string[] {
  const s = table.getState().columnOrder;
  if (s && s.length > 0) return s;
  return table.getAllLeafColumns().map((c) => c.id);
}

function currentPinning<TRow>(table: Table<TRow>): ColumnPinningState {
  const p = table.getState().columnPinning;
  return { left: p?.left ?? [], right: p?.right ?? [] };
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
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

export function ColumnReorderContext<TRow>({
  headers,
  height,
  totalWidth,
}: Props<TRow>) {
  const table = headers[0]?.getContext().table;
  const pinning = currentPinning(table!);
  const leftSet = useMemo(() => new Set(pinning.left), [pinning.left]);
  const rightSet = useMemo(() => new Set(pinning.right), [pinning.right]);

  const leftHeaders = headers.filter((h) => leftSet.has(h.column.id));
  const rightHeaders = headers.filter((h) => rightSet.has(h.column.id));
  const middleHeaders = headers.filter(
    (h) => !leftSet.has(h.column.id) && !rightSet.has(h.column.id),
  );

  const fixedPositionIds = useMemo(() => {
    const s = new Set<string>();
    if (!table) return s;
    for (const col of table.getAllLeafColumns()) {
      const dg = getDg(table, col.id);
      if (dg?.fixedPosition) s.add(col.id);
    }
    return s;
  }, [table]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const filtered = {
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => !fixedPositionIds.has(String(c.id)),
        ),
      };
      return closestCenter(filtered);
    },
    [fixedPositionIds],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !table) return;
      if (active.id === over.id) return;
      const activeId = String(active.id);
      const overId = String(over.id);

      const zoneOf = (id: string): "left" | "middle" | "right" =>
        leftSet.has(id) ? "left" : rightSet.has(id) ? "right" : "middle";
      const activeZone = zoneOf(activeId);
      const overZone = zoneOf(overId);
      if (activeZone !== overZone) return;

      if (activeZone === "middle") {
        const order = currentOrder(table);
        const pinned = new Set<string>([...leftSet, ...rightSet]);
        const middle = order.filter((id) => !pinned.has(id));
        const from = middle.indexOf(activeId);
        const to = middle.indexOf(overId);
        if (from < 0 || to < 0) return;
        const nextMiddle = arrayMove(middle, from, to);
        table.setColumnOrder(
          reorderMiddleInColumnOrder(order, pinned, nextMiddle),
        );
        return;
      }

      const pin = currentPinning(table);
      const src = activeZone === "left" ? pin.left : pin.right;
      const from = src.indexOf(activeId);
      const to = src.indexOf(overId);
      if (from < 0 || to < 0) return;
      const next = arrayMove(src, from, to);
      table.setColumnPinning(
        activeZone === "left"
          ? { left: next, right: pin.right }
          : { left: pin.left, right: next },
      );
    },
    [table, leftSet, rightSet],
  );

  const renderZone = (items: Header<TRow, unknown>[], key: string) => {
    const ids = items.map((h) => h.column.id);
    return (
      <SortableContext
        key={key}
        items={ids}
        strategy={horizontalListSortingStrategy}
      >
        {items.map((h) => {
          // Read live TanStack state at this un-memoed boundary and pass as
          // explicit props. See plan/01_architecture.md "Pattern — reading
          // TanStack state in memoed leaves".
          const pinned = h.column.getIsPinned();
          return (
            <SortableHeaderCell
              key={h.id}
              header={h}
              disabled={fixedPositionIds.has(h.column.id)}
              size={h.getSize()}
              pinned={pinned}
              pinLeft={pinned === "left" ? h.column.getStart("left") : 0}
              pinRight={pinned === "right" ? h.column.getAfter("right") : 0}
              sortDir={h.column.getIsSorted()}
            />
          );
        })}
      </SortableContext>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={onDragEnd}
    >
      <div
        className={styles.headerRow}
        style={{ height, width: totalWidth, minWidth: totalWidth }}
        role="row"
      >
        {renderZone(leftHeaders, "left")}
        {renderZone(middleHeaders, "middle")}
        {renderZone(rightHeaders, "right")}
      </div>
    </DndContext>
  );
}
