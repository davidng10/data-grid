import { type Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo } from "react";
import { Cell } from "./cells/InternalCell";
import type { GridSelectionStore } from "../gridSelectionStore";

type BodyProps<TData> = {
  rows: Row<TData>[];
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  bodyHeight: number;
  /**
   * Not read inside Body — included so the memo invalidates when the visible
   * leaf-column layout changes.
   */
  columnLayoutIdentity: string;
  store: GridSelectionStore;
  focusGrid: () => void;
};

const BodyInner = <TData,>({
  rows,
  virtualRows,
  virtualColumns,
  bodyHeight,
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
        const leftCells = row.getLeftVisibleCells();
        const rightCells = row.getRightVisibleCells();
        const centerCells = row.getCenterVisibleCells();
        const lastLeft = leftCells.length - 1;
        return (
          // Row uses transform: translateY for vertical placement; sticky cells
          // inside transformed parents work in modern Safari but were buggy
          // historically — if regressions appear, fall back to top: vr.start.
          <div
            key={row.id}
            className="dg-row"
            style={{
              height: vr.size,
              width: "var(--dg-total-width)",
              transform: `translateY(${vr.start}px)`,
            }}
          >
            {leftCells.map((cell, idx) => (
              <Cell
                key={cell.id}
                cell={cell}
                height={vr.size}
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
            {virtualColumns.map((vc) => {
              const cell = centerCells[vc.index];
              if (!cell) return null;
              return (
                <Cell
                  key={cell.id}
                  cell={cell}
                  height={vr.size}
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
                height={vr.size}
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
      })}
    </div>
  );
};

export const Body = memo(BodyInner) as typeof BodyInner;
