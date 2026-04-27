import { MoreOutlined } from "@ant-design/icons";
import { flexRender, type Header } from "@tanstack/react-table";
import { Button, Dropdown, type MenuProps } from "antd";
import { memo, useMemo, useState, type CSSProperties } from "react";

type Props<TData> = {
  header: Header<TData, unknown>;
  height: number;
  className: string;
  resizeEnabled: boolean;
};

// Width and position are read from CSS custom properties set on the scroll
// container by DataGrid. That makes this component's props invariant to
// column sizing changes — the memo skip below catches every resize commit.
const HeaderCellInner = <TData,>({
  header,
  height,
  className,
  resizeEnabled,
}: Props<TData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const pinned = header.column.getIsPinned();
  const canResize = header.column.getCanResize();
  const id = header.column.id;

  const items: MenuProps["items"] = [
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
  ];

  const wrapperClassName = menuOpen
    ? `${className} dg-header-cell-open`
    : className;

  const style: CSSProperties = useMemo(() => {
    if (pinned === "left") {
      return {
        height,
        width: `var(--dg-col-${id}-size)`,
        left: `var(--dg-col-${id}-pinned-left)`,
      };
    } else if (pinned === "right") {
      return {
        height,
        width: `var(--dg-col-${id}-size)`,
        right: `var(--dg-col-${id}-pinned-right)`,
      };
    } else {
      return {
        height,
        width: `var(--dg-col-${id}-size)`,
        transform: `translateX(calc(var(--dg-left-total) + var(--dg-col-${id}-start)))`,
      };
    }
  }, [height, id, pinned]);

  return (
    <div className={wrapperClassName} style={style}>
      {!header.isPlaceholder && (
        <>
          <span className="dg-header-cell-content">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
          <Dropdown
            menu={{ items }}
            trigger={["click"]}
            placement="bottomRight"
            open={menuOpen}
            onOpenChange={setMenuOpen}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className="dg-header-cell-trigger"
              aria-label="Column menu"
            />
          </Dropdown>
          {resizeEnabled && canResize && (
            <div
              className="dg-resize-handle"
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
