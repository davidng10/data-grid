import { useMemo, useRef, useState } from "react";
import { useDataGrid } from "../../hooks/useDataGrid";
import { useLocalStorageColumnConfig } from "../../hooks/useLocalStorageColumnConfig";
import {
  DataGrid,
  TextCell,
  type CellRenderer,
  type DataGridColumnDef,
  type DataGridHandle,
  type DataGridView,
  type SortingState,
} from "../../components/DataGrid";

type Row = {
  id: string;
  name: string;
  age: number;
  status: "active" | "inactive";
  email: string;
  meta: { x: number; tag: string };
};

type Filters = {
  status?: "active" | "inactive";
  minAge?: number;
};

const MOCK_ROWS: Row[] = Array.from({ length: 500 }, (_, i) => ({
  id: `row-${String(i).padStart(3, "0")}`,
  name: `Person ${String(i).padStart(3, "0")}`,
  age: 20 + (i % 50),
  status: i % 3 === 0 ? "inactive" : "active",
  email: `person${i}@example.com`,
  meta: { x: i, tag: `tag-${i % 7}` },
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

// Inline custom cell: renders the email as a mailto link. Demonstrates the
// "component reference lives on the column def" pattern.
const EmailLinkCell: CellRenderer<Row, string> = ({ value }) => {
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

const COLUMNS: DataGridColumnDef<Row>[] = [
  // No `cell` set → falls back to TextCell.
  {
    id: "id",
    header: "ID",
    accessor: (r) => r.id,
    width: 120,
  },
  // Explicit TextCell.
  {
    id: "name",
    header: "Name",
    accessor: (r) => r.name,
    cell: TextCell,
    width: 180,
  },
  // TextCell + align: 'right' to verify the alignment hint.
  {
    id: "age",
    header: "Age",
    accessor: (r) => r.age,
    cell: TextCell,
    align: "right",
    width: 90,
  },
  // Explicit TextCell (single-select style value, rendered as plain string).
  {
    id: "status",
    header: "Status",
    accessor: (r) => r.status,
    cell: TextCell,
    width: 120,
  },
  // Inline custom cell (link). Not sortable — the BE wouldn't support it either.
  {
    id: "email",
    header: "Email",
    accessor: (r) => r.email,
    cell: EmailLinkCell as CellRenderer<Row, unknown>,
    width: 260,
    meta: { sortable: false },
  },
  // Accessor returns an object → TextCell fallback renders "[object Object]".
  // Documented as the "set a proper cell" smell.
  {
    id: "meta",
    header: "Meta (object → ugly fallback)",
    accessor: (r) => r.meta,
    width: 260,
    meta: { sortable: false },
  },
];

export const PlaygroundPage = () => {
  const [view, setView] = useState<DataGridView<Filters>>({
    pageIndex: 0,
    pageSize: 100,
    sorting: [],
    filters: {},
  });

  const [columnConfig, setColumnConfig] = useLocalStorageColumnConfig(
    "playground-v1",
    {
      onWarn: (msg) => console.warn("[playground]", msg),
    },
  );

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
    columnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: totalCount,
  });

  const gridRef = useRef<DataGridHandle | null>(null);

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
        <h1 style={{ margin: 0, fontSize: 20 }}>
          DataGrid playground — session 2
        </h1>
        <p style={{ color: "#666", margin: "4px 0 12px" }}>
          Virtualized &lt;DataGrid /&gt; with sticky header, single-column
          sort, and TextCell-as-fallback.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            type="button"
            disabled={view.pageIndex === 0}
            onClick={() => grid.setPage(Math.max(0, view.pageIndex - 1))}
          >
            Prev
          </button>
          <span>
            Page {view.pageIndex + 1} / {totalPages} &middot; {totalCount} rows
          </span>
          <button
            type="button"
            disabled={view.pageIndex >= totalPages - 1}
            onClick={() =>
              grid.setPage(Math.min(totalPages - 1, view.pageIndex + 1))
            }
          >
            Next
          </button>

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

          <button
            type="button"
            onClick={() => grid.setFilters({ status: "active" })}
          >
            Filter: active
          </button>
          <button
            type="button"
            onClick={() => grid.setFilters({ status: "inactive" })}
          >
            Filter: inactive
          </button>
          <button
            type="button"
            onClick={() => grid.setFilters({ minAge: 40 })}
          >
            Filter: age ≥ 40
          </button>
          <button type="button" onClick={() => grid.setFilters({})}>
            Clear filters
          </button>

          <span style={{ width: 12 }} />

          <button type="button" onClick={() => grid.setSort([])}>
            Clear sort
          </button>
          <button
            type="button"
            onClick={() => gridRef.current?.scrollToTop()}
          >
            Scroll to top
          </button>
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
        />
      </div>

      <aside
        style={{
          position: "fixed",
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
