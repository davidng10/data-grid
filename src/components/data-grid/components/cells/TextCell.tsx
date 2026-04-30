import { Input, type InputRef } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import type { CellContext } from "@tanstack/react-table";

type TextCellProps<TData> = {
  info: CellContext<TData, unknown>;
  editable?: boolean;
};

export const TextCell = <TData,>({ info, editable }: TextCellProps<TData>) => {
  const value = String(info.getValue() ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<InputRef>(null);
  // Esc-cancel races with onBlur (the blur fires as a side effect of unmounting
  // the input). Without this flag, Esc would commit via the blur path.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus({ cursor: "all" });
  }, [editing]);

  if (!editable) return <>{value}</>;

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
        {value}
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
        // Parent owns revert; cell just exits edit mode.
      } finally {
        setPending(false);
        setEditing(false);
      }
    } else {
      setEditing(false);
    }
  };

  return (
    <Input
      ref={inputRef}
      className="dg-cell-input"
      variant="borderless"
      value={draft}
      disabled={pending}
      suffix={pending ? <LoadingOutlined /> : undefined}
      onChange={(e) => setDraft(e.target.value)}
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
