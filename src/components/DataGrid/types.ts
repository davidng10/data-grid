import type {
  OnChangeFn,
  HeaderContext as TSTHeaderContext,
  SortingState as TSTSortingState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

export type SortingState = TSTSortingState;

export type HeaderContext<TRow, TValue = unknown> = TSTHeaderContext<
  TRow,
  TValue
>;

export type DataGridCellAlign = "left" | "right" | "center";

export type PaginationState = {
  pageIndex: number;
  pageSize: number;
};

export type ColumnPinningState = {
  left: string[];
  right: string[];
};

export type ActiveEditorState = {
  rowId: string;
  columnId: string;
  draftValue: unknown;
} | null;

export type CellRangeEndpoint = {
  rowIndex: number;
  columnId: string;
};

export type CellRange = {
  anchor: CellRangeEndpoint;
  focus: CellRangeEndpoint;
};

export type CellRangeSelection = CellRange;

export type DataGridHandle = {
  scrollToRow: (
    rowIndex: number,
    options?: { align?: "start" | "center" | "end" },
  ) => void;
  scrollToTop: () => void;
};

export type DataGridView<TFilters> = {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  filters: TFilters;
};

export type ColumnConfigState = {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  columnPinning: ColumnPinningState;
  schemaVersion: 1;
};

export type DataGridColumnDef<TRow, TValue = unknown> = {
  id: string;
  header: string | ((ctx: HeaderContext<TRow, TValue>) => ReactNode);
  align?: DataGridCellAlign;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  pin?: "left" | "right" | null;
  fixedPin?: boolean;
  fixedVisible?: boolean;
  fixedPosition?: boolean;
  editable?: boolean;
  meta?: {
    sortable?: boolean;
    [k: string]: unknown;
  };

  accessor: (row: TRow) => TValue;
  render?: (props: DataGridCellProps<TRow, TValue>) => ReactNode;
};

export type DataGridCellProps<TRow, TValue = unknown> = {
  row: TRow;
  rowId: string;
  rowIndex: number;
  column: DataGridColumnDef<TRow, TValue>;
  value: TValue;
  align: DataGridCellAlign;
  isEditing: boolean;
  draftValue: TValue | undefined;
  isInRange: boolean;
  isRangeAnchor: boolean;
  isRangeFocus: boolean;
  isSelected: boolean;

  commitEdit: () => void;
  cancelEdit: () => void;
  setDraftValue: (next: TValue) => void;
};

export type DataGridProps<TRow> = {
  data: TRow[];
  rowCount: number;
  getRowId: (row: TRow) => string;
  isLoading?: boolean;

  columns: DataGridColumnDef<TRow>[];

  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;

  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: OnChangeFn<Record<string, boolean>>;

  cellRangeSelection?: CellRangeSelection | null;
  onCellRangeSelectionChange?: OnChangeFn<CellRangeSelection | null>;

  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: OnChangeFn<Record<string, boolean>>;

  columnOrder?: string[];
  onColumnOrderChange?: OnChangeFn<string[]>;

  columnSizing?: Record<string, number>;
  onColumnSizingChange?: OnChangeFn<Record<string, number>>;

  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>;

  activeEditor?: ActiveEditorState;
  onActiveEditorChange?: OnChangeFn<ActiveEditorState>;
  onCommitEdit?: (update: {
    rowId: string;
    columnId: string;
    value: unknown;
  }) => void | Promise<void>;

  allowSorting?: boolean;
  allowPinning?: boolean;
  allowReorder?: boolean;
  allowResize?: boolean;
  allowColumnVisibility?: boolean;
  allowRowSelection?: boolean;
  allowRangeSelection?: boolean;
  allowInlineEdit?: boolean;

  rowHeight?: number;
  headerHeight?: number;
  overscan?: number;

  // Right-click on a cell. The grid marks/preserves the range and fires this
  // event with the native MouseEvent — consumer renders their own menu.
  onRangeContextMenu?: (e: globalThis.MouseEvent, range: CellRange) => void;
  // Ctrl+C: fired only if provided. Consumer returns the string the grid
  // should write to the clipboard, or null/undefined/void to opt out (the
  // grid writes nothing). For the canned TSV behavior, call
  // `defaultRangeToTSV(range, getCellValue, columns)` and return its result.
  onRangeCopy?: (
    range: CellRange,
    ctx: RangeCopyContext<TRow>,
  ) => string | null | void;

  emptyState?: ReactNode;
  className?: string;
};

export type RangeCopyContext<TRow> = {
  getCellValue: (rowIndex: number, columnId: string) => unknown;
  // Visible columns in current visual order (left pinned → middle → right
  // pinned), filtered to those the range covers — matches what the user sees.
  columns: DataGridColumnDef<TRow>[];
};
