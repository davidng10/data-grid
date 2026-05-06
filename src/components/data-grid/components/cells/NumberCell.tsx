import { InputNumber } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type { CellContext } from "@tanstack/react-table";
import { useCellEditor } from "./useCellEditor";

type NumberCellProps<TData> = {
  info: CellContext<TData, unknown>;
  editable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
};

export const NumberCell = <TData,>({
  info,
  editable,
  min,
  max,
  step,
  precision,
}: NumberCellProps<TData>) => {
  const inputRef = useRef<ComponentRef<typeof InputNumber>>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const { editing, loading, cancelledRef, beginEdit, cancelEdit, commit } =
    useCellEditor();

  const raw = info.getValue();
  const value = (raw === null || raw === undefined ? null : Number(raw)) as
    | number
    | null;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      // Select-all on focus mirrors TextCell ergonomics. Reach through the
      // wrapper to the underlying <input>.
      inputRef.current?.nativeElement
        ?.querySelector<HTMLInputElement>("input")
        ?.select();
    }
  }, [editing]);

  const handleCommit = () => {
    commit({
      next: draft,
      current: value,
      updateData: (next) =>
        info.table.options.meta?.updateData?.(
          info.row.index,
          info.column.id,
          next,
        ),
    });
  };

  if (!editable) return <>{value ?? ""}</>;

  if (!editing) {
    return (
      <div
        className="dg-cell-display"
        onDoubleClick={() => {
          if (loading) return;
          setDraft(value);
          beginEdit();
        }}
      >
        {value ?? ""}
      </div>
    );
  }

  return (
    <InputNumber
      ref={inputRef}
      className="dg-cell-input"
      value={draft}
      disabled={loading}
      min={min}
      max={max}
      step={step}
      precision={precision}
      controls={false}
      suffix={<LoadingOutlined style={{ opacity: loading ? 1 : 0 }} />}
      onChange={(v) => setDraft(v as number | null)}
      onPressEnter={handleCommit}
      onBlur={() => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        handleCommit();
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
