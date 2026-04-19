import { message } from "antd";

import { TextCell } from "../../../components/DataGrid";

import type { DataGridColumnDef } from "../../../components/DataGrid";

export const useColumns = () => {
  // oxlint-disable-next-line typescript/no-explicit-any
  const COLUMNS: DataGridColumnDef<any>[] = [
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
      render: ({ value }) => {
        const text = String(value ?? "");
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
      },
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
      render: ({ rowId }) => (
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
      ),
      width: 120,
      pin: "right",
      fixedPin: true,
      fixedVisible: true,
      fixedPosition: true,
      meta: { sortable: false },
    },
  ];

  return COLUMNS;
};
