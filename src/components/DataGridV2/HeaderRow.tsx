import { memo } from "react";

import HeaderCell from "./HeaderCell";
import type { IterateOverViewportColumnsForRow } from "./hooks";
import type { Position } from "./types";

import headerRowStyles from "./styles/HeaderRow.module.css";

interface HeaderRowProps<R> {
  readonly iterateOverViewportColumnsForRow: IterateOverViewportColumnsForRow<R>;
  /** `idx` of the active cell when the active row is the header (rowIdx=-1), else `-1`. */
  readonly activeCellIdx: number;
  /** True when the grid has no active position — promotes the first header cell to tab-focusable. */
  readonly shouldFocusGrid: boolean;
  readonly setActivePosition: (position: Position) => void;
  /** Layer 6. Stable identity; forwarded to each resizable HeaderCell. */
  readonly onColumnResize: (columnKey: string, width: number) => void;
}

function HeaderRow<R>({
  iterateOverViewportColumnsForRow,
  activeCellIdx,
  shouldFocusGrid,
  setActivePosition,
  onColumnResize,
}: HeaderRowProps<R>) {
  const cells: React.ReactNode[] = [];
  let firstHeaderCell = true;
  for (const [column, isCellActive] of iterateOverViewportColumnsForRow(
    activeCellIdx,
  )) {
    cells.push(
      <HeaderCell
        key={column.key}
        column={column}
        isCellActive={isCellActive}
        shouldFocusGrid={shouldFocusGrid && firstHeaderCell}
        setActivePosition={setActivePosition}
        onColumnResize={onColumnResize}
      />,
    );
    firstHeaderCell = false;
  }

  return (
    <div role="row" aria-rowindex={1} className={headerRowStyles.headerRow}>
      {cells}
    </div>
  );
}

const HeaderRowComponent = memo(HeaderRow) as <R>(
  props: HeaderRowProps<R>,
) => React.JSX.Element;

export default HeaderRowComponent;
