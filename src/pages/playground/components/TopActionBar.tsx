import { Button } from "antd";

import type { DataGridView } from "../../../components/DataGrid";
import type { UseDataGridResult } from "../../../components/DataGrid/hooks/useDataGrid";

interface TopActionBarProps {
  // oxlint-disable-next-line typescript/no-explicit-any
  grid: UseDataGridResult<any, any>;
  // oxlint-disable-next-line typescript/no-explicit-any
  view: DataGridView<any>;
  totalPages: number;
  totalCount: number;
  setColumnsModalOpen: (open: boolean) => void;
  scrollToTop: () => void;
}

export const TopActionBar = ({
  grid,
  view,
  totalPages,
  totalCount,
  setColumnsModalOpen,
  scrollToTop,
}: TopActionBarProps) => {
  return (
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
      <Button size="small" onClick={scrollToTop}>
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

      <Button size="small" onClick={() => grid.selection.clear()}>
        Clear row selection
      </Button>
      <Button size="small" onClick={() => grid.rangeSelection.clear()}>
        Clear range
      </Button>
    </div>
  );
};
