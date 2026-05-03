import { type Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo } from "react";
import { Cell } from "./cells/InternalCell";
import type { SelectionStore } from "../selectionStore";

type BodyProps<TData> = {
  rows: Row<TData>[];
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  bodyHeight: number;
  /**
   * Not read inside Body — included so the memo invalidates when pinning / order
   * changes.
   * Without this prop Body would skip and the body would render stale cell distribution.
   */
  configIdentity: string;
  store: SelectionStore;
};

const BodyInner = <TData,>({
  rows,
  virtualRows,
  virtualColumns,
  bodyHeight,
  store,
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
        const centerOffset = leftCells.length;
        const rightOffset = leftCells.length + centerCells.length;
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
                rowIdx={vr.index}
                colIdx={idx}
                store={store}
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
                  rowIdx={vr.index}
                  colIdx={centerOffset + vc.index}
                  store={store}
                  className="dg-cell"
                />
              );
            })}
            {rightCells.map((cell, idx) => (
              <Cell
                key={cell.id}
                cell={cell}
                height={vr.size}
                rowIdx={vr.index}
                colIdx={rightOffset + idx}
                store={store}
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
