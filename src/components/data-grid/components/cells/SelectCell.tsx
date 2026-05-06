import { Select } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import type { CellContext } from "@tanstack/react-table";
import { useCellEditor } from "./useCellEditor";

type SelectOption = { label: string; value: string | number };

type SelectCellProps<TData> = {
  info: CellContext<TData, unknown>;
  editable?: boolean;
  options: SelectOption[];
};

export const SelectCell = <TData,>({
  info,
  editable,
  options,
}: SelectCellProps<TData>) => {
  const value = info.getValue() as string | number | null | undefined;
  const [pendingValue, setPendingValue] = useState<typeof value>(undefined);
  const { editing, loading, pending, beginEdit, cancelEdit, commit } =
    useCellEditor();

  const labelByValue = useMemo(() => {
    const m = new Map<string | number, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const displayed =
    value === null || value === undefined
      ? ""
      : (labelByValue.get(value) ?? String(value));

  if (!editable) return <>{displayed}</>;

  if (!editing) {
    return (
      <div
        className="dg-cell-display"
        onDoubleClick={() => {
          if (loading) return;
          beginEdit();
        }}
      >
        {displayed}
      </div>
    );
  }

  const handleCommit = (next: typeof value) => {
    commit({
      next,
      current: value,
      updateData: (n) =>
        info.table.options.meta?.updateData?.(
          info.row.index,
          info.column.id,
          n,
        ),
      // pendingValue keeps the Select displaying the chosen option while the
      // parent's data update is still on the transition lane.
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
        cancelEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancelEdit();
        }
      }}
    />
  );
};
