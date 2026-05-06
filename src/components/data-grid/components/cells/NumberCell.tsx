import { InputNumber } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type { RowData } from "@tanstack/react-table";
import type { DataGridEditCellContext } from "../../types";

type NumberCellProps<TData extends RowData> = {
  context: DataGridEditCellContext<TData, unknown>;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
};

export const NumberCell = <TData extends RowData>({
  context,
  min,
  max,
  step,
  precision,
}: NumberCellProps<TData>) => {
  const inputRef = useRef<ComponentRef<typeof InputNumber>>(null);
  const raw = context.value;
  const value = (raw === null || raw === undefined ? null : Number(raw)) as
    | number
    | null;
  const [draft, setDraft] = useState<number | null>(value);
  const { loading, cancelledRef, cancel, commit } = context;

  useEffect(() => {
    inputRef.current?.focus();
    // Select-all on focus mirrors TextCell ergonomics. Reach through the
    // wrapper to the underlying <input>.
    inputRef.current?.nativeElement
      ?.querySelector<HTMLInputElement>("input")
      ?.select();
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, [cancelledRef]);

  const handleCommit = () => {
    commit(draft, { current: value });
  };

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
          cancel();
        }
      }}
    />
  );
};
