import type { Column } from "../../components/DataGridV2";

export interface Row {
  id: number;
}

export function makeRows(count: number): Row[] {
  const rows: Row[] = new Array(count);
  for (let i = 0; i < count; i++) {
    rows[i] = { id: i };
  }
  return rows;
}

export function makeColumns(count: number): Column<Row>[] {
  const columns: Column<Row>[] = new Array(count);
  for (let i = 0; i < count; i++) {
    columns[i] = {
      key: `col-${i}`,
      name: `Col ${i}`,
      width: 120,
      // Synthesize cell content from row + column index so we don't have to
      // materialize N*M strings up front (would OOM at 1M × 1k).
      renderCell: ({ row }) => `R${row.id}·${i}`,
    };
  }
  return columns;
}
