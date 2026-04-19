import { useMemo } from "react";

import { CheckboxCell } from "../components/cells/CheckboxCell";
import { HeaderCheckbox } from "../components/header/HeaderCheckbox";
import { SELECT_COLUMN_ID } from "../constants";
import { toTSColumns } from "../utils/columns";

import type { ColumnDef, ColumnPinningState } from "@tanstack/react-table";
import type { DataGridColumnDef } from "../types";

const SELECT_COLUMN: DataGridColumnDef<unknown> = {
  id: SELECT_COLUMN_ID,
  header: () => <HeaderCheckbox />,
  accessor: () => null,
  render: (p) => <CheckboxCell {...p} />,
  width: 44,
  minWidth: 44,
  maxWidth: 44,
  pin: "left",
  fixedPin: true,
  fixedPosition: true,
  fixedVisible: true,
  meta: { sortable: false },
};

interface UseDataGridColumnsOptions<TRow> {
  columns: DataGridColumnDef<TRow>[];
  columnPinning: ColumnPinningState;
  allowRowSelection: boolean;
}

interface UseDataGridColumnsResult<TRow> {
  columns: ColumnDef<TRow>[];
  columnPinning?: ColumnPinningState;
}

export function useDataGridColumns<TRow>({
  columns,
  columnPinning,
  allowRowSelection,
}: UseDataGridColumnsOptions<TRow>): UseDataGridColumnsResult<TRow> {
  // Inject the synthetic __select__ column when row selection is enabled. The
  // column object itself is module-scoped & stable; the array reference still
  // changes whenever `dgColumns` does, so memo deps stay honest.
  const effectiveColumns = useMemo<ColumnDef<TRow>[]>(() => {
    const getAugmentedColumns = () => {
      if (!allowRowSelection) return columns;
      return [SELECT_COLUMN as unknown as DataGridColumnDef<TRow>, ...columns];
    };

    return toTSColumns(getAugmentedColumns());
  }, [columns, allowRowSelection]);

  // When `allowRowSelection` is on, force the __select__ column into the left
  // pinned set so the table treats it as fixed-left even if the consumer
  // didn't pre-seed `columnPinning.left`. We splice rather than override so
  // user-provided pin order is preserved.
  const effectiveColumnPinning = useMemo<ColumnPinningState | undefined>(() => {
    if (!allowRowSelection)
      return columnPinning as ColumnPinningState | undefined;
    const left = columnPinning?.left ?? [];
    const right = columnPinning?.right ?? [];
    if (left.includes(SELECT_COLUMN_ID)) {
      return { left, right };
    }
    return { left: [SELECT_COLUMN_ID, ...left], right };
  }, [allowRowSelection, columnPinning]);

  return {
    columns: effectiveColumns,
    columnPinning: effectiveColumnPinning,
  };
}
