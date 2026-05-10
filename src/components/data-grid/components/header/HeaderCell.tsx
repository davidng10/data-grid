import { MoreOutlined } from "@ant-design/icons";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { flexRender, type Header } from "@tanstack/react-table";
import { Button, Dropdown, type MenuProps } from "antd";
import { memo, useMemo, useState, type CSSProperties } from "react";
import { GRID_Z_INDEX } from "../../constants";

type SortableTransform = { x: number; y: number } | null;
type HeaderPinnedState = false | "left" | "right";

type Props<TData> = {
  header: Header<TData, unknown>;
  height: number;
  className: string;
  resizeEnabled: boolean;
  // Sortable wiring is passed flat (rather than as one object) so that for
  // non-dragging cells the prop refs stay stable across pointer-move
  // re-renders inside SortableContext, and React.memo below can skip.
  // Pinned cells receive these as undefined and skip the sortable code.
  sortableSetNode?: (el: HTMLElement | null) => void;
  sortableSetActivatorNode?: (el: HTMLElement | null) => void;
  sortableListeners?: DraggableSyntheticListeners;
  sortableAttributes?: DraggableAttributes;
  sortableTransform?: SortableTransform;
  sortableTransition?: string;
  sortableIsDragging?: boolean;
};

type HeaderCellMenuProps<TData> = {
  header: Header<TData, unknown>;
  pinned: HeaderPinnedState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const HeaderCellMenuInner = <TData,>({
  header,
  pinned,
  open,
  onOpenChange,
}: HeaderCellMenuProps<TData>) => {
  const items = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "no-pin",
        label: "No Pin",
        onClick: () => header.column.pin(false),
      },
      {
        key: "pin-left",
        label: <span>Pin Left</span>,
        disabled: pinned === "left",
        onClick: () => header.column.pin("left"),
      },
      {
        key: "pin-right",
        label: <span>Pin Right</span>,
        disabled: pinned === "right",
        onClick: () => header.column.pin("right"),
      },
    ],
    [header, pinned],
  );

  return (
    <Dropdown
      menu={{ items }}
      trigger={["click"]}
      placement="bottomRight"
      open={open}
      onOpenChange={onOpenChange}
    >
      <Button
        type="text"
        size="small"
        icon={<MoreOutlined />}
        className="dg-header-cell-trigger"
        aria-label="Column menu"
      />
    </Dropdown>
  );
};

const HeaderCellMenu = memo(HeaderCellMenuInner) as typeof HeaderCellMenuInner;

const HeaderCellInner = <TData,>({
  header,
  height,
  className,
  resizeEnabled,
  sortableSetNode,
  sortableSetActivatorNode,
  sortableListeners,
  sortableAttributes,
  sortableTransform,
  sortableTransition,
  sortableIsDragging,
}: Props<TData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const pinned = header.column.getIsPinned();
  const canResize = header.column.getCanResize();
  const id = header.column.id;
  const isSortable = sortableSetNode !== undefined;

  let wrapperClassName = className;
  if (menuOpen) wrapperClassName += " dg-header-cell-open";
  if (sortableIsDragging) wrapperClassName += " dg-header-cell-dragging";

  // Center cells position via `left` (not transform) so dnd-kit's measurement
  // sees the correct rect. dnd-kit calls getBoundingClientRect with
  // ignoreTransform: true and runs inverseTransform on the element's CSS
  // transform — meaning a `transform: translateX(slot)` would be stripped and
  // every cell would measure to the same x=0, breaking collision detection
  // and the strategy. With `left`, the slot position lives in the layout box
  // and only dnd-kit's own transform sits in `transform`.
  const style: CSSProperties = useMemo(() => {
    let base: CSSProperties;
    if (pinned === "left") {
      base = {
        height,
        width: `var(--dg-col-${id}-size)`,
        left: `var(--dg-col-${id}-pinned-left)`,
        zIndex: GRID_Z_INDEX.headerPinnedCell,
      };
    } else if (pinned === "right") {
      base = {
        height,
        width: `var(--dg-col-${id}-size)`,
        right: `var(--dg-col-${id}-pinned-right)`,
        zIndex: GRID_Z_INDEX.headerPinnedCell,
      };
    } else {
      base = {
        height,
        width: `var(--dg-col-${id}-size)`,
        left: `calc(var(--dg-left-total) + var(--dg-col-${id}-start))`,
      };
      if (sortableTransform) {
        base.transform = `translate3d(${sortableTransform.x}px, ${sortableTransform.y}px, 0)`;
      }
      // dnd-kit returns a transition string (e.g. "transform 200ms ease") on
      // non-dragging cells during a sort, and undefined on the dragged cell
      // itself (so cursor tracking is lag-free). Forwarding it as-is gives
      // neighbours a smooth slide-out, and a slide-in on drop when their
      // index changes (via dnd-kit's useDerivedTransform).
      if (sortableTransition) {
        base.transition = sortableTransition;
      }
    }
    if (sortableIsDragging) {
      base.zIndex = GRID_Z_INDEX.draggingHeaderCell;
    }
    return base;
  }, [height, id, pinned, sortableTransform, sortableTransition, sortableIsDragging]);

  return (
    <div
      ref={sortableSetNode}
      className={wrapperClassName}
      style={style}
    >
      {!header.isPlaceholder && (
        <>
          <span
            ref={sortableSetActivatorNode}
            className={
              isSortable
                ? "dg-header-cell-content dg-header-cell-grab"
                : "dg-header-cell-content"
            }
            {...(sortableListeners ?? {})}
            {...(sortableAttributes ?? {})}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          <HeaderCellMenu
            header={header}
            pinned={pinned}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
          {resizeEnabled && canResize && (
            <div
              className="dg-resize-handle"
              style={{ zIndex: GRID_Z_INDEX.resizeHandle }}
              onMouseDown={header.getResizeHandler()}
              onTouchStart={header.getResizeHandler()}
              onDoubleClick={() => header.column.resetSize()}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize column"
            />
          )}
        </>
      )}
    </div>
  );
};

export const HeaderCell = memo(HeaderCellInner) as typeof HeaderCellInner;
