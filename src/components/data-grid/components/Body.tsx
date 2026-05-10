import { type Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo } from "react";
import { Cell } from "./cells/InternalCell";
import type { GridSelectionStore } from "../store/gridSelectionStore";

type BodyProps<TData> = {
  rows: Row<TData>[];
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  bodyHeight: number;
  /**
   * Not read inside Body — included so the memo invalidates when the visible
   * leaf-column layout changes. Using prop instead of key because key changes
   * will discard all subtrees fibers.
   */
  columnLayoutIdentity: string;
  store: GridSelectionStore;
  focusGrid: () => void;
};

type VirtualRowProps<TData> = {
  row: Row<TData>;
  virtualRow: VirtualItem;
  virtualColumns: VirtualItem[];
  columnLayoutIdentity: string;
  store: GridSelectionStore;
  focusGrid: () => void;
};

const VirtualRowInner = <TData,>({
  row,
  virtualRow,
  virtualColumns,
  store,
  focusGrid,
}: VirtualRowProps<TData>) => {
  const leftCells = row.getLeftVisibleCells();
  const centerCells = row.getCenterVisibleCells();
  const rightCells = row.getRightVisibleCells();
  const lastLeft = leftCells.length - 1;

  return (
    // Row uses transform: translateY for vertical placement; sticky cells
    // inside transformed parents work in modern Safari but were buggy
    // historically — if regressions appear, fall back to top: vr.start.
    <div
      className="dg-row"
      style={{
        height: virtualRow.size,
        width: "var(--dg-total-width)",
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {leftCells.map((cell, idx) => (
        <Cell
          key={cell.id}
          cell={cell}
          height={virtualRow.size}
          rowId={row.id}
          columnId={cell.column.id}
          store={store}
          focusGrid={focusGrid}
          className={
            idx === lastLeft
              ? "dg-cell dg-pinned-left dg-pinned-left-last"
              : "dg-cell dg-pinned-left"
          }
        />
      ))}
      {virtualColumns.map((virtualColumn) => {
        const cell = centerCells[virtualColumn.index];
        if (!cell) return null;
        return (
          <Cell
            key={cell.id}
            cell={cell}
            height={virtualRow.size}
            rowId={row.id}
            columnId={cell.column.id}
            store={store}
            focusGrid={focusGrid}
            className="dg-cell"
          />
        );
      })}
      {rightCells.map((cell, idx) => (
        <Cell
          key={cell.id}
          cell={cell}
          height={virtualRow.size}
          rowId={row.id}
          columnId={cell.column.id}
          store={store}
          focusGrid={focusGrid}
          className={
            idx === 0
              ? "dg-cell dg-pinned-right dg-pinned-right-first"
              : "dg-cell dg-pinned-right"
          }
        />
      ))}
    </div>
  );
};

const VirtualRow = memo(VirtualRowInner) as typeof VirtualRowInner;

const BodyInner = <TData,>({
  rows,
  virtualRows,
  virtualColumns,
  bodyHeight,
  columnLayoutIdentity,
  store,
  focusGrid,
}: BodyProps<TData>) => {
  return (
    <div
      className="dg-body"
      style={{ height: bodyHeight, width: "var(--dg-total-width)" }}
    >
      {virtualRows.map((vr) => {
        const row = rows[vr.index];
        if (!row) return null;
        return (
          <VirtualRow
            key={row.id}
            row={row}
            virtualRow={vr}
            virtualColumns={virtualColumns}
            columnLayoutIdentity={columnLayoutIdentity}
            store={store}
            focusGrid={focusGrid}
          />
        );
      })}
    </div>
  );
};

export const Body = memo(BodyInner) as typeof BodyInner;
