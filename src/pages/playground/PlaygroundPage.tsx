import { useMemo, useState } from "react";
import { useDataGrid } from "../../hooks/useDataGrid";
import { useLocalStorageColumnConfig } from "../../hooks/useLocalStorageColumnConfig";
import type {
  DataGridProps,
  DataGridView,
  SortingState,
} from "../../components/DataGrid/DataGrid.types";

type Row = {
  id: string;
  name: string;
  age: number;
  status: "active" | "inactive";
};

type Filters = {
  status?: "active" | "inactive";
  minAge?: number;
};

const MOCK_ROWS: Row[] = Array.from({ length: 500 }, (_, i) => ({
  id: `row-${i}`,
  name: `Person ${String(i).padStart(3, "0")}`,
  age: 20 + (i % 50),
  status: i % 3 === 0 ? "inactive" : "active",
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

const COLUMN_IDS = ["id", "name", "age", "status"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];

export const PlaygroundPage = () => {
  const [view, setView] = useState<DataGridView<Filters>>({
    pageIndex: 0,
    pageSize: 25,
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

  // Type assignment check (stopping criterion): gridProps must be assignable
  // to Partial<DataGridProps<Row>>. Session 2 will spread this onto <DataGrid />.
  const gridProps: Partial<DataGridProps<Row>> = grid.gridProps;

  const rowSelection = gridProps.rowSelection ?? {};
  const pageRowIds = paged.map((r) => r.id);
  const allVisibleSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => rowSelection[id]);

  const toggleAllVisible = () => {
    const next: Record<string, boolean> = { ...rowSelection };
    if (allVisibleSelected) {
      for (const id of pageRowIds) delete next[id];
    } else {
      for (const id of pageRowIds) next[id] = true;
    }
    gridProps.onRowSelectionChange?.(next);
  };

  const toggleRow = (id: string) => {
    const next: Record<string, boolean> = { ...rowSelection };
    if (next[id]) delete next[id];
    else next[id] = true;
    gridProps.onRowSelectionChange?.(next);
  };

  const currentSort = view.sorting[0];

  const cycleSort = (columnId: ColumnId) => {
    if (!currentSort || currentSort.id !== columnId) {
      grid.setSort([{ id: columnId, desc: false }]);
    } else if (!currentSort.desc) {
      grid.setSort([{ id: columnId, desc: true }]);
    } else {
      grid.setSort([]);
    }
  };

  const sortIndicator = (columnId: ColumnId) => {
    if (!currentSort || currentSort.id !== columnId) return "";
    return currentSort.desc ? " ↓" : " ↑";
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: 0 }}>DataGrid playground — session 1</h1>
      <p style={{ color: "#666" }}>
        Naive &lt;table&gt;. Proves useDataGrid state transitions without any
        grid component yet.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          margin: "12px 0",
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
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        <span style={{ width: 12 }} />

        <button type="button" onClick={() => grid.setFilters({ status: "active" })}>
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

        <button
          type="button"
          onClick={() => grid.setSort([{ id: "name", desc: false }])}
        >
          Sort by name (asc)
        </button>
        <button type="button" onClick={() => grid.setSort([])}>
          Clear sort
        </button>
        <button type="button" onClick={() => grid.selection.clear()}>
          Clear selection
        </button>
      </div>

      <table
        border={1}
        cellPadding={6}
        style={{ borderCollapse: "collapse", minWidth: 640 }}
      >
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
              />
            </th>
            {COLUMN_IDS.map((id) => (
              <th
                key={id}
                style={{ cursor: "pointer", textAlign: "left" }}
                onClick={() => cycleSort(id)}
              >
                {id}
                {sortIndicator(id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_IDS.length + 1} style={{ color: "#999" }}>
                No rows
              </td>
            </tr>
          ) : (
            paged.map((row) => {
              const checked = Boolean(rowSelection[row.id]);
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                  <td>{row.age}</td>
                  <td>{row.status}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

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
          <strong>selection.rowIds</strong>
        </div>
        <div style={{ wordBreak: "break-all" }}>
          {JSON.stringify(grid.selection.rowIds)}
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>view</strong>: pageIndex={view.pageIndex}, pageSize=
          {view.pageSize}, sort={JSON.stringify(view.sorting)}, filters=
          {JSON.stringify(view.filters)}
        </div>
      </aside>
    </div>
  );
};
