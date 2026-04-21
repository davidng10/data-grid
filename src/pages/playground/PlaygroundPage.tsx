import { useMemo, useRef, useState } from "react";
import { message } from "antd";

import {
  DataGrid,
  defaultRangeToTSV,
  useDataGrid,
} from "../../components/DataGrid";
import { useLocalStorageColumnConfig } from "../../hooks/useLocalStorageColumnConfig";
import { ColumnVisibilityModal } from "./components/ColumnVisibilityModal";
import { TopActionBar } from "./components/TopActionBar";
import { useColumns } from "./hooks/useColumns";

import type {
  CellRange,
  DataGridColumnDef,
  DataGridRef,
  DataGridView,
  SortingState,
} from "../../components/DataGrid";

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

const MAX_VISIBLE = 40;

export const PlaygroundPage = () => {
  const [view, setView] = useState<DataGridView<Filters>>({
    pageIndex: 0,
    pageSize: 100,
    sorting: [],
    filters: {},
  });

  const columns = useColumns();

  const [columnConfig, setColumnConfig] =
    useLocalStorageColumnConfig("playground-v2");

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
    columns,
    columnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: totalCount,
    maxVisibleColumns: MAX_VISIBLE,
  });

  const gridRef = useRef<DataGridRef | null>(null);

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
        <TopActionBar
          grid={grid}
          view={view}
          totalPages={totalPages}
          totalCount={totalCount}
          setColumnsModalOpen={setColumnsModalOpen}
          scrollToTop={() => gridRef.current?.scrollToTop()}
          clearRange={() => gridRef.current?.clearRange()}
        />
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
          columns={columns}
          onRangeContextMenu={onRangeContextMenu}
          onRangeCopy={onRangeCopy}
          allowSorting
          allowPinning
          allowRangeSelection
          allowReorder
          allowResize
          allowColumnVisibility
          allowRowSelection
        />
      </div>

      <ColumnVisibilityModal
        open={columnsModalOpen}
        onClose={() => setColumnsModalOpen(false)}
        columns={columns}
        visibility={grid.gridProps.columnVisibility ?? {}}
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
