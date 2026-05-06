import { Select } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import type { RowData } from "@tanstack/react-table";
import type { DataGridEditCellContext } from "../../types";

type SelectOption = { label: string; value: string | number };

type SelectCellProps<TData extends RowData> = {
  context: DataGridEditCellContext<TData, unknown>;
  options: SelectOption[];
};

export const SelectCell = <TData extends RowData>({
  context,
  options,
}: SelectCellProps<TData>) => {
  const value = context.value as string | number | null | undefined;
  const [pendingValue, setPendingValue] = useState<typeof value>(undefined);
  const { loading, pending, cancelledRef, cancel, commit } = context;

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, [cancelledRef]);

  const handleCommit = (next: typeof value) => {
    commit(next, {
      current: value,
      onPending: () => setPendingValue(next),
      onSettled: () => setPendingValue(undefined),
    });
  };

  return (
    <Select
      className="dg-cell-input dg-cell-select"
      autoFocus
      defaultOpen
      disabled={loading}
      value={pending ? pendingValue : value}
      options={options}
      suffixIcon={<LoadingOutlined style={{ opacity: loading ? 1 : 0 }} />}
      onChange={handleCommit}
      onBlur={() => {
        // loading=true means a commit is in flight; don't tear down the
        // Select. Otherwise blur means "user clicked away without picking" —
        // exit cleanly.
        if (loading) return;
        cancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      }}
    />
  );
};
