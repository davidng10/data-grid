import {
  flexRender,
  type Cell as TableCell,
  type ColumnOrderState,
  type ColumnPinningState,
  type Row,
} from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo, type CSSProperties } from "react";

type BodyProps<TData> = {
  rows: Row<TData>[];
  virtualRows: VirtualItem[];
  virtualColumns: VirtualItem[];
  bodyHeight: number;
  // Not read inside Body — included so the memo invalidates when pinning
  // changes. row.getLeftVisibleCells / getCenterVisibleCells /
  // getRightVisibleCells return different cell sets per zone after a pin,
  // even though `rows` itself is reference-equal. Without this prop Body
  // would skip and the body would render stale cell distribution.
  columnPinning: ColumnPinningState | undefined;
  // Same unused-prop-for-memo trick as columnPinning: row.getCenterVisibleCells
  // returns reordered cells when columnOrder changes, but the `rows` reference
  // doesn't, so Body needs an explicit signal to re-render.
  columnOrder: ColumnOrderState | undefined;
};

type CellProps<TData> = {
  cell: TableCell<TData, unknown>;
  height: number;
  className: string;
};

// Width and position are read from CSS custom properties set on the scroll
// container by DataGrid. Cells take only invariant props (cell ref, row
// height, className) so the memo skip below catches every column-size
// commit — the browser repaints widths via CSS without any cell render.
const CellInner = <TData,>({ cell, height, className }: CellProps<TData>) => {
  const id = cell.column.id;
  const pinned = cell.column.getIsPinned();

  let style: CSSProperties;
  if (pinned === "left") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      left: `var(--dg-col-${id}-pinned-left)`,
    };
  } else if (pinned === "right") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      right: `var(--dg-col-${id}-pinned-right)`,
    };
  } else {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      transform: `translateX(calc(var(--dg-left-total) + var(--dg-col-${id}-start)))`,
    };
  }

  return (
    <div className={className} style={style}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
};

const Cell = memo(CellInner) as typeof CellInner;

// Body is memoized. Its props are stable across resize commits (no totalWidth
// here — it lives in a CSS var), so during a drag with measure() suppressed,
// virtualRows/virtualColumns/rows references stay equal and Body skips its
// 600+ cell iteration entirely. Scroll still re-renders Body because
// getVirtualItems returns a new array when scroll position changes.
const BodyInner = <TData,>({
  rows,
  virtualRows,
  virtualColumns,
  bodyHeight,
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
        const centerCells = row.getCenterVisibleCells();
        const rightCells = row.getRightVisibleCells();
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
                  className="dg-cell"
                />
              );
            })}
            {rightCells.map((cell, idx) => (
              <Cell
                key={cell.id}
                cell={cell}
                height={vr.size}
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
