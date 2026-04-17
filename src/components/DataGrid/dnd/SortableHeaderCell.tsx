import type { Header } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { HeaderCell, type HeaderCellDragProps } from "../header/HeaderCell";

type Props<TRow> = {
  header: Header<TRow, unknown>;
  disabled: boolean;
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

export function SortableHeaderCell<TRow>({ header, disabled }: Props<TRow>) {
  const {
    setNodeRef,
    transform,
    transition,
    listeners,
    attributes,
    isDragging,
  } = useSortable({ id: header.column.id, disabled });

  const drag: HeaderCellDragProps = {
    setNodeRef,
    transformStyle: transformToString(transform),
    transitionStyle: transition ?? undefined,
    listeners,
    attributes,
    isDragging,
    disabled,
  };

  return <HeaderCell header={header} drag={drag} />;
}

