import { useMemo, useRef, useState } from "react";
import { Button, Checkbox, Modal, Tooltip, message } from "antd";

import type {
  CellRange,
  DataGridCellProps,
  DataGridColumnDef,
  DataGridHandle,
  DataGridView,
  SortingState,
} from "../../components/DataGrid";

import {
  DataGrid,
  TextCell,
  defaultRangeToTSV,
} from "../../components/DataGrid";
import { useDataGrid } from "../../components/DataGrid/useDataGrid";
import { useLocalStorageColumnConfig } from "../../hooks/useLocalStorageColumnConfig";

type Row = {
  id: string;
  name: string;
  age: number;
  status: "active" | "inactive";
  email: string;
  city: string;
  department: string;
  joined: string;
  meta: { x: number; tag: string };
  actions: string;
};

type Filters = {
  status?: "active" | "inactive";
  minAge?: number;
};

const CITIES = ["Singapore", "Tokyo", "Berlin", "New York", "London"];
const DEPARTMENTS = ["Eng", "Sales", "Ops", "HR", "Finance"];

const MOCK_ROWS: Row[] = Array.from({ length: 500 }, (_, i) => ({
  id: `row-${String(i).padStart(3, "0")}`,
  name: `Person ${String(i).padStart(3, "0")}`,
  age: 20 + (i % 50),
  status: i % 3 === 0 ? "inactive" : "active",
  email: `person${i}@example.com`,
  city: CITIES[i % CITIES.length],
  department: DEPARTMENTS[i % DEPARTMENTS.length],
  joined: new Date(2020, i % 12, (i % 27) + 1).toISOString().slice(0, 10),
  meta: { x: i, tag: `tag-${i % 7}` },
  actions: "…",
}));

function applyFilters(rows: Row[], filters: Filters): Row[] {
  return rows.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.minAge != null && r.age < filters.minAge) return false;
    return true;
  });
}

function applySorting(rows: Row[], sorting: SortingState): Row[] {
  if (sorting.length === 0) return rows;
  const [primary] = sorting;
  const copy = rows.slice();
  copy.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[primary.id];
    const bv = (b as unknown as Record<string, unknown>)[primary.id];
    if (av == null && bv == null) return 0;
    if (av == null) return primary.desc ? 1 : -1;
    if (bv == null) return primary.desc ? -1 : 1;
    const bothNumbers = typeof av === "number" && typeof bv === "number";
    const bothStrings = typeof av === "string" && typeof bv === "string";
    if (!bothNumbers && !bothStrings) return 0;
    if (av < bv) return primary.desc ? 1 : -1;
    if (av > bv) return primary.desc ? -1 : 1;
    return 0;
  });
  return copy;
}

function applyPagination(
  rows: Row[],
  pageIndex: number,
  pageSize: number,
): Row[] {
  const start = pageIndex * pageSize;
  return rows.slice(start, start + pageSize);
}

const renderEmailLink = ({ value }: DataGridCellProps<Row, string>) => {
  const text = value ?? "";
  return (
    <a
      href={`mailto:${text}`}
      onClick={(e) => e.stopPropagation()}
      style={{ color: "#2563eb", textDecoration: "none" }}
      title={text}
    >
      {text}
    </a>
  );
};

const renderActions = ({ rowId }: DataGridCellProps<Row, string>) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      message.info(`Row action on ${rowId}`);
    }}
    style={{
      padding: "2px 8px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 3,
      cursor: "pointer",
      fontSize: 12,
    }}
  >
    Open
  </button>
);

const COLUMNS: DataGridColumnDef<Row>[] = [
  // Fixed-pin-left + fixed-visible + fixed-position — the classic "identifier" column.
  {
    id: "id",
    header: "ID",
    accessor: (r) => r.id,
    width: 120,
    pin: "left",
    fixedPin: true,
    fixedVisible: true,
    fixedPosition: true,
  },
  // Fixed-position, but user-movable pin + visibility.
  {
    id: "name",
    header: "Name",
    accessor: (r) => r.name,
    render: TextCell,
    width: 180,
    fixedPosition: true,
  },
  {
    id: "age",
    header: "Age",
    accessor: (r) => r.age,
    render: TextCell,
    align: "right",
    width: 90,
  },
  {
    id: "status",
    header: "Status",
    accessor: (r) => r.status,
    render: TextCell,
    width: 120,
  },
  {
    id: "email",
    header: "Email",
    accessor: (r) => r.email,
    render: renderEmailLink,
    width: 260,
    meta: { sortable: false },
  },
  {
    id: "city",
    header: "City",
    accessor: (r) => r.city,
    render: TextCell,
    width: 140,
  },
  {
    id: "department",
    header: "Department",
    accessor: (r) => r.department,
    render: TextCell,
    width: 140,
  },
  {
    id: "joined",
    header: "Joined",
    accessor: (r) => r.joined,
    render: TextCell,
    width: 130,
  },
  {
    id: "meta",
    header: "Meta (object → ugly fallback)",
    accessor: (r) => r.meta,
    width: 260,
    meta: { sortable: false },
  },
  // Fixed-pin-right — e.g., persistent actions column.
  {
    id: "actions",
    header: "Actions",
    accessor: (r) => r.actions,
    render: renderActions,
    width: 120,
    pin: "right",
    fixedPin: true,
    fixedVisible: true,
    fixedPosition: true,
    meta: { sortable: false },
  },
];

const FIXED_PIN_LEFT = COLUMNS.filter(
  (c) => c.fixedPin && c.pin === "left",
).map((c) => c.id);
const FIXED_PIN_RIGHT = COLUMNS.filter(
  (c) => c.fixedPin && c.pin === "right",
).map((c) => c.id);
const FIXED_VISIBLE = COLUMNS.filter((c) => c.fixedVisible).map((c) => c.id);
const FIXED_POSITION = COLUMNS.filter((c) => c.fixedPosition).map((c) => c.id);

const MAX_VISIBLE = 40;

export const PlaygroundPage = () => {
  const [view, setView] = useState<DataGridView<Filters>>({
    pageIndex: 0,
    pageSize: 100,
    sorting: [],
    filters: {},
  });
  const [isLoading, setIsLoading] = useState(false);

  const [columnConfig, setColumnConfig] = useLocalStorageColumnConfig(
    "playground-v2",
    {
      maxVisibleColumns: MAX_VISIBLE,
      fixedVisibleColumnIds: FIXED_VISIBLE,
      fixedPins: { left: FIXED_PIN_LEFT, right: FIXED_PIN_RIGHT },
      onWarn: (msg) => message.warning(msg),
    },
  );

  // The persistence helper returns EMPTY_STATE when localStorage has no
  // entry, which misses fixed-pin enforcement on first load. Compute an
  // effective config that seeds defaults when stored order is empty; the
  // stored state receives the seeded value on the first user-driven change.
  const effectiveColumnConfig = useMemo(() => {
    if (columnConfig.columnOrder.length > 0) return columnConfig;
    return {
      columnVisibility: Object.fromEntries(COLUMNS.map((c) => [c.id, true])),
      columnOrder: COLUMNS.map((c) => c.id),
      columnSizing: columnConfig.columnSizing,
      columnPinning: {
        left: FIXED_PIN_LEFT,
        right: FIXED_PIN_RIGHT,
      },
      schemaVersion: 1 as const,
    };
  }, [columnConfig]);

  const filtered = useMemo(
    () => applyFilters(MOCK_ROWS, view.filters),
    [view.filters],
  );
  const sorted = useMemo(
    () => applySorting(filtered, view.sorting),
    [filtered, view.sorting],
  );
  const paged = useMemo(
    () => applyPagination(sorted, view.pageIndex, view.pageSize),
    [sorted, view.pageIndex, view.pageSize],
  );

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / view.pageSize));

  const grid = useDataGrid<Row, Filters>({
    view,
    onViewChange: setView,
    columnConfig: effectiveColumnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: totalCount,
    maxVisibleColumns: MAX_VISIBLE,
    fixedVisibleColumnIds: FIXED_VISIBLE,
    fixedPositionColumnIds: FIXED_POSITION,
    fixedPinnedLeft: FIXED_PIN_LEFT,
    fixedPinnedRight: FIXED_PIN_RIGHT,
  });

  const gridRef = useRef<DataGridHandle | null>(null);

  const [columnsModalOpen, setColumnsModalOpen] = useState(false);

  // Right-click on a cell range opens a stand-in "menu" — real consumers
  // would render their own (Copy, Bulk edit, Export, …). The grid itself
  // never renders a menu.
  const onRangeContextMenu = (e: globalThis.MouseEvent, range: CellRange) => {
    const rows = Math.abs(range.focus.rowIndex - range.anchor.rowIndex) + 1;
    e.preventDefault();
    message.info(
      `Range context menu: ${rows} row(s), anchor ${range.anchor.columnId} → focus ${range.focus.columnId}`,
    );
  };

  // Ctrl+C: hand back the canned TSV. Returning the string causes the grid
  // to call navigator.clipboard.writeText for us. We log it as well so the
  // playground demo can confirm what was copied without leaving the tab.
  const onRangeCopy = (
    range: CellRange,
    ctx: {
      getCellValue: (r: number, c: string) => unknown;
      columns: DataGridColumnDef<Row>[];
    },
  ) => {
    const tsv = defaultRangeToTSV(range, ctx.getCellValue, ctx.columns);
    console.log("[playground] onRangeCopy →", { range, tsv });
    return tsv;
  };

  const showSelection = () => {
    const range = grid.rangeSelection.current;
    const rangeStr = range
      ? `range: rows ${Math.min(range.anchor.rowIndex, range.focus.rowIndex)}–${Math.max(range.anchor.rowIndex, range.focus.rowIndex)}, cols ${range.anchor.columnId} → ${range.focus.columnId}`
      : "range: (none)";
    message.info(
      `Selected rows (${grid.selection.rowIds.length}): ${grid.selection.rowIds.slice(0, 5).join(", ")}${grid.selection.rowIds.length > 5 ? "…" : ""} · ${rangeStr}`,
      6,
    );
  };

  const toggleLoading = () => {
    setIsLoading((prev) => !prev);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ flexShrink: 0, padding: "16px 16px 8px" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>DataGrid playground</h1>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Button
            size="small"
            disabled={view.pageIndex === 0}
            onClick={() => grid.setPage(Math.max(0, view.pageIndex - 1))}
          >
            Prev
          </Button>
          <span>
            Page {view.pageIndex + 1} / {totalPages} &middot; {totalCount} rows
          </span>
          <Button
            size="small"
            disabled={view.pageIndex >= totalPages - 1}
            onClick={() =>
              grid.setPage(Math.min(totalPages - 1, view.pageIndex + 1))
            }
          >
            Next
          </Button>

          <label>
            {" "}
            Page size:{" "}
            <select
              value={view.pageSize}
              onChange={(e) => grid.setPageSize(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </label>

          <span style={{ width: 12 }} />
          <Button size="small" onClick={toggleLoading}>
            {isLoading ? "Stop loading" : "Start loading"}
          </Button>
          <Button
            size="small"
            onClick={() => grid.setFilters({ status: "active" })}
          >
            Filter: active
          </Button>
          <Button
            size="small"
            onClick={() => grid.setFilters({ status: "inactive" })}
          >
            Filter: inactive
          </Button>
          <Button size="small" onClick={() => grid.setFilters({ minAge: 40 })}>
            Filter: age ≥ 40
          </Button>
          <Button size="small" onClick={() => grid.setFilters({})}>
            Clear filters
          </Button>

          <span style={{ width: 12 }} />

          <Button size="small" onClick={() => grid.setSort([])}>
            Clear sort
          </Button>
          <Button size="small" onClick={() => gridRef.current?.scrollToTop()}>
            Scroll to top
          </Button>

          <span style={{ width: 12 }} />

          <Button
            size="small"
            type="primary"
            onClick={() => setColumnsModalOpen(true)}
          >
            Columns…
          </Button>

          <span style={{ width: 12 }} />

          <Button size="small" onClick={showSelection}>
            Show selection
          </Button>
          <Button size="small" onClick={() => grid.selection.clear()}>
            Clear row selection
          </Button>
          <Button size="small" onClick={() => grid.rangeSelection.clear()}>
            Clear range
          </Button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          padding: "0 16px 16px",
        }}
      >
        <DataGrid<Row>
          ref={gridRef}
          {...grid.gridProps}
          data={paged}
          rowCount={totalCount}
          getRowId={(r) => r.id}
          columns={COLUMNS}
          onRangeContextMenu={onRangeContextMenu}
          onRangeCopy={onRangeCopy}
          isLoading={isLoading}
        />
      </div>

      <ColumnVisibilityModal
        open={columnsModalOpen}
        onClose={() => setColumnsModalOpen(false)}
        columns={COLUMNS}
        visibility={effectiveColumnConfig.columnVisibility}
        onApply={(next) => {
          grid.gridProps.onColumnVisibilityChange?.(next);
          setColumnsModalOpen(false);
        }}
      />

      <aside
        style={{
          position: "fixed",
          zIndex: 99999,
          right: 16,
          bottom: 16,
          background: "#111",
          color: "#eee",
          padding: "8px 12px",
          fontSize: 12,
          borderRadius: 6,
          maxWidth: 360,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div>
          <strong>view</strong>: pageIndex={view.pageIndex}, pageSize=
          {view.pageSize}, sort={JSON.stringify(view.sorting)}, filters=
          {JSON.stringify(view.filters)}
        </div>
      </aside>
    </div>
  );
};

type ColumnVisibilityModalProps = {
  open: boolean;
  onClose: () => void;
  columns: DataGridColumnDef<Row>[];
  visibility: Record<string, boolean>;
  onApply: (next: Record<string, boolean>) => void;
};

function ColumnVisibilityModal({
  open,
  onClose,
  columns,
  visibility,
  onApply,
}: ColumnVisibilityModalProps) {
  const [pending, setPending] = useState<Record<string, boolean>>(visibility);
  const [lastOpen, setLastOpen] = useState(open);

  // Derived-state pattern — on the transition to open, reseed pending from
  // the current grid visibility. See React docs, "Adjusting some state when
  // a prop changes" — cheaper and simpler than useEffect + setState.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setPending(visibility);
  }

  const visibleCount = useMemo(
    () => Object.values(pending).filter(Boolean).length,
    [pending],
  );

  const toggle = (id: string, next: boolean) => {
    const col = columns.find((c) => c.id === id);
    if (col?.fixedVisible) return;
    if (next && visibleCount >= MAX_VISIBLE && !pending[id]) {
      message.warning(`Maximum ${MAX_VISIBLE} columns. Uncheck one first.`);
      return;
    }
    setPending((p) => ({ ...p, [id]: next }));
  };

  return (
    <Modal
      title="Columns"
      open={open}
      onCancel={onClose}
      onOk={() => onApply(pending)}
      okText="Apply"
      cancelText="Cancel"
      width={420}
    >
      <div
        style={{
          maxHeight: 400,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {columns.map((c) => {
          const checked = c.fixedVisible ? true : !!pending[c.id];
          const disabled = !!c.fixedVisible;
          const checkbox = (
            <Checkbox
              checked={checked}
              disabled={disabled}
              onChange={(e) => toggle(c.id, e.target.checked)}
            >
              {typeof c.header === "string" ? c.header : c.id}
            </Checkbox>
          );
          return (
            <div key={c.id}>
              {disabled ? (
                <Tooltip title="Always shown">{checkbox}</Tooltip>
              ) : (
                checkbox
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        {visibleCount} / {MAX_VISIBLE} columns selected
      </div>
    </Modal>
  );
}
