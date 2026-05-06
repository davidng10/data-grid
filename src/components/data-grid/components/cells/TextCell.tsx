import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import type { CellContext } from "@tanstack/react-table";
import { useCellEditor } from "./useCellEditor";

type TextCellProps<TData> = {
  info: CellContext<TData, unknown>;
  editable?: boolean;
};

/**
 * TextCell uses input for handling edits
 * because it has no overheads compared to using a component library.
 */
export const TextCell = <TData,>({ info, editable }: TextCellProps<TData>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const { editing, loading, cancelledRef, beginEdit, cancelEdit, commit } =
    useCellEditor();

  const value = String(info.getValue() ?? "");

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }
  }, [editing]);

  const handleEnableEditing = () => {
    if (loading) return;
    setDraft(value);
    beginEdit();
  };

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

  if (!editable) return <>{value}</>;

  if (!editing) {
    return (
      <div className="dg-cell-display" onDoubleClick={handleEnableEditing}>
        {value}
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        className="dg-cell-input"
        value={draft}
        disabled={loading}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelledRef.current) {
            cancelledRef.current = false;
            return;
          }
          handleCommit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleCommit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
          }
        }}
      />
      {loading && <LoadingOutlined className="dg-cell-input-suffix" />}
    </>
  );
};
