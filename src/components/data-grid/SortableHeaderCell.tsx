import { useSortable } from "@dnd-kit/sortable";
import type { Header } from "@tanstack/react-table";

import { HeaderCell } from "./HeaderCell";

type Props<TData> = {
  header: Header<TData, unknown>;
  height: number;
  className: string;
  resizeEnabled: boolean;
};

// Thin parent that subscribes the cell to dnd-kit's SortableContext. Kept
// separate from HeaderCell so that pinned cells (rendered outside the
// SortableContext) don't have to call useSortable. This component is
// intentionally NOT memoized: SortableContext re-renders descendants on
// pointer move during a drag, but the values forwarded to the memoized
// HeaderCell stay reference-stable for non-dragging cells, so HeaderCell
// itself still skips.
export const SortableHeaderCell = <TData,>({
  header,
  height,
  className,
  resizeEnabled,
}: Props<TData>) => {
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.column.id });

  return (
    <HeaderCell
      header={header}
      height={height}
      className={className}
      resizeEnabled={resizeEnabled}
      sortableSetNodeRef={setNodeRef}
      sortableSetActivatorRef={setActivatorNodeRef}
      sortableListeners={listeners}
      sortableAttributes={attributes}
      sortableTransform={
        transform ? { x: transform.x, y: transform.y } : null
      }
      sortableTransition={transition}
      sortableIsDragging={isDragging}
    />
  );
};
