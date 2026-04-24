import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  SyntheticEvent,
} from "react";

// ---- identity ------------------------------------------------------------

export type RowKey = string | number;

// ---- sort ----------------------------------------------------------------

export type SortDirection = "ASC" | "DESC";

export interface SortColumn {
  readonly columnKey: string;
  readonly direction: SortDirection;
}

// ---- coordinate ----------------------------------------------------------

/**
 * Grid coordinate.
 * - `rowIdx = -1` → header row.
 * - `rowIdx = 0..N-1` → data rows.
 * - `idx` indexes into the *calculated* column array (internal columns
 *   prepended), not the user-supplied column array.
 */
export interface Position {
  readonly idx: number;
  readonly rowIdx: number;
}

// ---- columns -------------------------------------------------------------

export interface Column<R> {
  readonly key: string;
  readonly name: string | ReactNode;
  /** number (px), `'auto'`, or a flex spec like `'1fr'`. */
  readonly width?: number | string;
  /** default {@link DEFAULT_MIN_WIDTH} (50). */
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly frozen?: boolean;
  readonly resizable?: boolean;
  readonly draggable?: boolean;
  readonly sortable?: boolean;
  readonly renderCell?: (props: RenderCellProps<R>) => ReactNode;
  readonly renderHeaderCell?: (props: RenderHeaderCellProps<R>) => ReactNode;
  readonly cellClass?: string | ((row: R) => string | undefined);
  readonly headerCellClass?: string;
}

/**
 * Column shape after {@link Column} defaults are resolved and the column has
 * taken its place in the calculated array. Produced by `useCalculatedColumns`
 * (layer 1); consumed everywhere below.
 */
export interface CalculatedColumn<R> extends Column<R> {
  readonly idx: number;
  readonly width: number | string;
  readonly minWidth: number;
  readonly maxWidth: number | undefined;
  readonly frozen: boolean;
  readonly resizable: boolean;
  readonly draggable: boolean;
  readonly sortable: boolean;
  readonly renderCell: (props: RenderCellProps<R>) => ReactNode;
  readonly renderHeaderCell: (props: RenderHeaderCellProps<R>) => ReactNode;
}

// ---- render props --------------------------------------------------------

export interface RenderCellProps<R> {
  column: CalculatedColumn<R>;
  row: R;
  rowIdx: number;
  tabIndex: number;
}

export interface RenderHeaderCellProps<R> {
  column: CalculatedColumn<R>;
  sortDirection: SortDirection | undefined;
  tabIndex: number;
}

// ---- cell events ---------------------------------------------------------

export type CellEvent<E extends SyntheticEvent<HTMLDivElement>> = E & {
  preventGridDefault: () => void;
  isGridDefaultPrevented: () => boolean;
};

export type CellMouseEvent = CellEvent<ReactMouseEvent<HTMLDivElement>>;
export type CellKeyboardEvent = CellEvent<ReactKeyboardEvent<HTMLDivElement>>;

export interface CellMouseArgs<R> {
  column: CalculatedColumn<R>;
  row: R;
  rowIdx: number;
  /** Programmatically focus this cell (without toggling edit mode; editing is out of scope in v1). */
  setActivePosition: () => void;
}

export interface CellKeyDownArgs<R> {
  mode: "ACTIVE";
  /** `undefined` when the event fires on the header row. */
  column: CalculatedColumn<R> | undefined;
  /** `undefined` when the event fires on the header row. */
  row: R | undefined;
  rowIdx: number;
  setActivePosition: (position: Position) => void;
}

// ---- imperative handle ---------------------------------------------------

export interface DataGridHandle {
  element: HTMLDivElement | null;
  scrollToCell: (pos: { idx?: number; rowIdx?: number }) => void;
  setActivePosition: (pos: Position) => void;
}

// ---- expansion config ----------------------------------------------------

export interface ExpandableConfig<R> {
  readonly rowExpandable?: boolean | ((row: R) => boolean);
  readonly expandedRowRender: (row: R) => ReactNode;
  /** Fixed for the whole grid — all expanded rows share this detail height. */
  readonly detailHeight: number;
  readonly defaultExpandedRowKeys?: readonly RowKey[];
  readonly onExpandedChange?: (keys: ReadonlySet<RowKey>) => void;
}

// ---- top-level props -----------------------------------------------------

export interface DataGridProps<R> {
  columns: readonly Column<R>[];
  rows: readonly R[];
  rowKeyGetter: (row: R) => RowKey;

  rowHeight?: number;
  headerRowHeight?: number;

  // --- Selection (controlled) ---
  selectedRows?: ReadonlySet<RowKey>;
  onSelectedRowsChange?: (selected: Set<RowKey>) => void;
  isRowSelectionDisabled?: (row: R) => boolean;

  // --- Expansion (uncontrolled in v1; consumer gets notified via onExpandedChange) ---
  expandable?: ExpandableConfig<R>;

  // --- Column behaviour (state stays internal in v1) ---
  onColumnResize?: (columnKey: string, width: number) => void;
  onColumnOrderChange?: (order: readonly string[]) => void;

  // --- Sort (controlled; single column in v1) ---
  sortColumn?: SortColumn | null;
  onSortColumnChange?: (sort: SortColumn | null) => void;

  // --- Cell events ---
  onCellClick?: (args: CellMouseArgs<R>, event: CellMouseEvent) => void;
  onCellKeyDown?: (args: CellKeyDownArgs<R>, event: CellKeyboardEvent) => void;

  // --- Pass-through ---
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}
