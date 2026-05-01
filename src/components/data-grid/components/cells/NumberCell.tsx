import { InputNumber } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentRef,
} from "react";
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
  const [isPendingTransition, startTransition] = useTransition();
  const loading = pending || isPendingTransition;

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
          if (loading) return;
          cancelledRef.current = false;
          setDraft(value);
          setEditing(true);
        }}
      >
        {value ?? ""}
      </div>
    );
  }

  const commit = () => {
    if (loading) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    const updateData = info.table.options.meta?.updateData;

    let result: Promise<void> | undefined;
    startTransition(() => {
      const r = updateData?.(info.row.index, info.column.id, draft);
      if (r instanceof Promise) result = r;
    });

    if (result) {
      setPending(true);
      result
        .catch(() => {})
        .finally(() => {
          startTransition(() => {
            setEditing(false);
            setPending(false);
          });
        });
    } else {
      startTransition(() => {
        setEditing(false);
      });
    }
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
      suffix={loading ? <LoadingOutlined /> : undefined}
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
