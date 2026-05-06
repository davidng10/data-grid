import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import type { RowData } from "@tanstack/react-table";
import type { DataGridEditCellContext } from "../../types";

type TextCellProps<TData extends RowData> = {
  context: DataGridEditCellContext<TData, unknown>;
};

/**
 * TextCell uses input for grid-owned edits
 * because it has no overheads compared to using a component library.
 */
export const TextCell = <TData extends RowData>({
  context,
}: TextCellProps<TData>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const value = String(context.value ?? "");
  const [draft, setDraft] = useState(value);
  const { loading, cancelledRef, cancel, commit } = context;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
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
            cancel();
          }
        }}
      />
      {loading && <LoadingOutlined className="dg-cell-input-suffix" />}
    </>
  );
};
