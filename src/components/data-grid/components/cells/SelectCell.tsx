import { Select } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import type { CellContext } from "@tanstack/react-table";

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
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingValue, setPendingValue] = useState<typeof value>(undefined);

  const labelByValue = useMemo(() => {
    const m = new Map<string | number, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const displayed =
    value === null || value === undefined ? "" : (labelByValue.get(value) ?? String(value));

  if (!editable) return <>{displayed}</>;

  if (!editing) {
    return (
      <div
        className="dg-cell-display"
        onDoubleClick={() => {
          setEditing(true);
        }}
      >
        {displayed}
      </div>
    );
  }

  const commit = async (next: typeof value) => {
    if (pending) return;
    if (next === value) {
      setEditing(false);
      return;
    }
    const updateData = info.table.options.meta?.updateData;
    const result = updateData?.(info.row.index, info.column.id, next);
    if (result instanceof Promise) {
      setPendingValue(next);
      setPending(true);
      try {
        await result;
      } catch {
        // Parent owns revert.
      } finally {
        setPending(false);
        setPendingValue(undefined);
        setEditing(false);
      }
    } else {
      setEditing(false);
    }
  };

  return (
    <Select
      className="dg-cell-input dg-cell-select"
      variant="borderless"
      autoFocus
      defaultOpen
      disabled={pending}
      value={pending ? pendingValue : value}
      options={options}
      suffixIcon={pending ? <LoadingOutlined /> : undefined}
      onChange={commit}
      onBlur={() => {
        // pending=true means a commit is in flight; don't tear down the Select.
        // Otherwise blur means "user clicked away without picking" — exit cleanly.
        if (pending) return;
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setEditing(false);
        }
      }}
    />
  );
};
