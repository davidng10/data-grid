import { useSortable } from "@dnd-kit/sortable";
import type { Header } from "@tanstack/react-table";
import { memo, useMemo } from "react";

import { HeaderCell } from "./HeaderCell";

type Props<TData> = {
  header: Header<TData, unknown>;
  height: number;
  className: string;
  resizeEnabled: boolean;
};

const SortableHeaderCellInner = <TData,>({
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

  const sortableTransform = useMemo(() => {
    return transform ? { x: transform.x, y: transform.y } : null;
  }, [transform]);

  return (
    <HeaderCell
      header={header}
      height={height}
      className={className}
      resizeEnabled={resizeEnabled}
      sortableSetNode={setNodeRef}
      sortableSetActivatorNode={setActivatorNodeRef}
      sortableListeners={listeners}
      sortableAttributes={attributes}
      sortableTransform={sortableTransform}
      sortableTransition={transition}
      sortableIsDragging={isDragging}
    />
  );
};

export const SortableHeaderCell = memo(
  SortableHeaderCellInner,
) as typeof SortableHeaderCellInner;
