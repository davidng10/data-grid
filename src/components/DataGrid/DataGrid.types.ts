import type { ComponentType, MouseEvent, ReactNode } from "react";
import type {
  HeaderContext as TSTHeaderContext,
  OnChangeFn,
  SortingState as TSTSortingState,
} from "@tanstack/react-table";

export type SortingState = TSTSortingState;

export type HeaderContext<TRow, TValue = unknown> = TSTHeaderContext<
  TRow,
  TValue
>;

export type Align = "left" | "right" | "center";

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
  accessor: (row: TRow) => TValue;

  cell?: CellRenderer<TRow, TValue>;
  align?: Align;

  width?: number;
  minWidth?: number;
  maxWidth?: number;

  pin?: "left" | "right" | null;
  fixedPin?: boolean;
  fixedPosition?: boolean;
  fixedVisible?: boolean;

  editable?: boolean;

  meta?: {
    sortable?: boolean;
    [k: string]: unknown;
  };
};

export type DataGridCellProps<TRow, TValue = unknown> = {
  row: TRow;
  rowId: string;
  rowIndex: number;
  column: DataGridColumnDef<TRow, TValue>;
  value: TValue;
  align: Align;

  isEditing: boolean;
  draftValue: TValue | undefined;
  setDraftValue: (next: TValue) => void;
  commitEdit: () => void;
  cancelEdit: () => void;

  isInRange: boolean;
  isRangeAnchor: boolean;
  isRangeFocus: boolean;

  extras: Record<string, unknown>;
};

export type CellRenderer<TRow = unknown, TValue = unknown> = ComponentType<
  DataGridCellProps<TRow, TValue>
>;

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

  cellExtras?: Record<string, unknown>;

  onRangeContextMenu?: (e: MouseEvent, range: CellRange) => void;
  onRangeCopy?: (range: CellRange, tsv: string) => void;

  emptyState?: ReactNode;
  className?: string;
};
