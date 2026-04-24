import { memo } from "react";

import HeaderCell from "./HeaderCell";
import type { CalculatedColumn } from "./types";

import headerRowStyles from "./styles/HeaderRow.module.css";

interface HeaderRowProps<R> {
  readonly columns: readonly CalculatedColumn<R>[];
}

function HeaderRow<R>({ columns }: HeaderRowProps<R>) {
  return (
    <div role="row" aria-rowindex={1} className={headerRowStyles.headerRow}>
      {columns.map((column) => (
        <HeaderCell key={column.key} column={column} />
      ))}
    </div>
  );
}

const HeaderRowComponent = memo(HeaderRow) as <R>(
  props: HeaderRowProps<R>,
) => React.JSX.Element;

export default HeaderRowComponent;
