import { InputNumber } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type { CellContext } from "@tanstack/react-table";

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
  const cancelledRef = useRef(false);

  const raw = info.getValue();
  const value = (raw === null || raw === undefined ? null : Number(raw)) as
    | number
    | null;

  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);

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

  if (!editable) return <>{value ?? ""}</>;

  if (!editing) {
    return (
      <div
        className="dg-cell-display"
        onDoubleClick={() => {
          cancelledRef.current = false;
          setDraft(value);
          setEditing(true);
        }}
      >
        {value ?? ""}
      </div>
    );
  }

  const commit = async () => {
    if (pending) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    const updateData = info.table.options.meta?.updateData;
    const result = updateData?.(info.row.index, info.column.id, draft);
    if (result instanceof Promise) {
      setPending(true);
      try {
        await result;
      } catch {
        // Parent owns revert.
      } finally {
        setPending(false);
        setEditing(false);
      }
    } else {
      setEditing(false);
    }
  };

  return (
    <InputNumber
      ref={inputRef}
      className="dg-cell-input"
      variant="borderless"
      value={draft}
      disabled={pending}
      min={min}
      max={max}
      step={step}
      precision={precision}
      controls={false}
      suffix={pending ? <LoadingOutlined /> : undefined}
      onChange={(v) => setDraft(v as number | null)}
      onPressEnter={commit}
      onBlur={() => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancelledRef.current = true;
          setEditing(false);
        }
      }}
    />
  );
};
