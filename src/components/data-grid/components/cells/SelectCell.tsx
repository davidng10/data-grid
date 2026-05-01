import { Select } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useMemo, useState, useTransition } from "react";
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
  const [isPendingTransition, startTransition] = useTransition();
  const loading = pending || isPendingTransition;

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
          setEditing(true);
        }}
      >
        {displayed}
      </div>
    );
  }

  const commit = (next: typeof value) => {
    if (loading) return;
    if (next === value) {
      setEditing(false);
      return;
    }
    const updateData = info.table.options.meta?.updateData;

    let result: Promise<void> | undefined;
    startTransition(() => {
      const r = updateData?.(info.row.index, info.column.id, next);
      if (r instanceof Promise) result = r;
    });

    if (result) {
      // pendingValue keeps the Select displaying the chosen option while the
      // parent's data update is still on the transition lane.
      setPendingValue(next);
      setPending(true);
      result
        .catch(() => {})
        .finally(() => {
          startTransition(() => {
            setEditing(false);
            setPending(false);
            setPendingValue(undefined);
          });
        });
    } else {
      startTransition(() => {
        setEditing(false);
      });
    }
  };

  return (
    <Select
      className="dg-cell-input dg-cell-select"
      autoFocus
      defaultOpen
      disabled={loading}
      value={pending ? pendingValue : value}
      options={options}
      suffixIcon={loading ? <LoadingOutlined /> : undefined}
      onChange={commit}
      onBlur={() => {
        // loading=true means a commit is in flight; don't tear down the Select.
        // Otherwise blur means "user clicked away without picking" — exit cleanly.
        if (loading) return;
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
