import { useSortable } from "@dnd-kit/sortable";
import type { Header } from "@tanstack/react-table";

import { HeaderCell } from "./HeaderCell";

type SortDir = false | "asc" | "desc";

type Props<TRow> = {
  header: Header<TRow, unknown>;
  disabled: boolean;
  size: number;
  pinned: "left" | "right" | false;
  pinLeft: number;
  pinRight: number;
  sortDir: SortDir;
};

type Transform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

function transformToString(t: Transform | null): string | undefined {
  if (!t) return undefined;
  return `translate3d(${t.x}px, ${t.y}px, 0) scaleX(${t.scaleX}) scaleY(${t.scaleY})`;
}

export function SortableHeaderCell<TRow>({
  header,
  disabled,
  size,
  pinned,
  pinLeft,
  pinRight,
  sortDir,
}: Props<TRow>) {
  const {
    setNodeRef,
    transform,
    transition,
    listeners,
    attributes,
    isDragging,
  } = useSortable({ id: header.column.id, disabled });

  return (
    <HeaderCell
      header={header}
      size={size}
      pinned={pinned}
      pinLeft={pinLeft}
      pinRight={pinRight}
      sortDir={sortDir}
      dragSetNodeRef={setNodeRef}
      dragTransform={transformToString(transform)}
      dragTransition={transition ?? undefined}
      dragListeners={listeners}
      dragAttributes={attributes}
      dragIsDragging={isDragging}
      dragDisabled={disabled}
    />
  );
}
