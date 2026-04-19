import { useMemo, useState } from "react";
import { Checkbox, Modal, Tooltip, message } from "antd";

import type { DataGridColumnDef } from "../../../components/DataGrid/types";

const MAX_VISIBLE = 40;

type ColumnVisibilityModalProps = {
  open: boolean;
  onClose: () => void;
  // oxlint-disable-next-line typescript/no-explicit-any
  columns: DataGridColumnDef<any>[];
  visibility: Record<string, boolean>;
  onApply: (next: Record<string, boolean>) => void;
};

export function ColumnVisibilityModal({
  open,
  onClose,
  columns,
  visibility,
  onApply,
}: ColumnVisibilityModalProps) {
  const [pending, setPending] = useState<Record<string, boolean>>(visibility);
  const [lastOpen, setLastOpen] = useState(open);

  // Derived-state pattern — on the transition to open, reseed pending from
  // the current grid visibility. See React docs, "Adjusting some state when
  // a prop changes" — cheaper and simpler than useEffect + setState.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setPending(visibility);
  }

  const visibleCount = useMemo(
    () => Object.values(pending).filter(Boolean).length,
    [pending],
  );

  const toggle = (id: string, next: boolean) => {
    const col = columns.find((c) => c.id === id);
    if (col?.fixedVisible) return;
    if (next && visibleCount >= MAX_VISIBLE && !pending[id]) {
      message.warning(`Maximum ${MAX_VISIBLE} columns. Uncheck one first.`);
      return;
    }
    setPending((p) => ({ ...p, [id]: next }));
  };

  return (
    <Modal
      title="Columns"
      open={open}
      onCancel={onClose}
      onOk={() => onApply(pending)}
      okText="Apply"
      cancelText="Cancel"
      width={420}
    >
      <div
        style={{
          maxHeight: 400,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {columns.map((c) => {
          const checked = c.fixedVisible ? true : !!pending[c.id];
          const disabled = !!c.fixedVisible;
          const checkbox = (
            <Checkbox
              checked={checked}
              disabled={disabled}
              onChange={(e) => toggle(c.id, e.target.checked)}
            >
              {typeof c.header === "string" ? c.header : c.id}
            </Checkbox>
          );
          return (
            <div key={c.id}>
              {disabled ? (
                <Tooltip title="Always shown">{checkbox}</Tooltip>
              ) : (
                checkbox
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        {visibleCount} / {MAX_VISIBLE} columns selected
      </div>
    </Modal>
  );
}
