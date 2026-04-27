import { MoreOutlined } from "@ant-design/icons";
import { flexRender, type Header } from "@tanstack/react-table";
import { Button, Dropdown, type MenuProps } from "antd";
import { useState, type CSSProperties } from "react";

type Props<TData> = {
  header: Header<TData, unknown>;
  height: number;
  className: string;
  style: CSSProperties;
};

export const HeaderCell = <TData,>({
  header,
  height,
  className,
  style,
}: Props<TData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const pinned = header.column.getIsPinned();

  const items: MenuProps["items"] = [
    {
      key: "no-pin",
      label: "No Pin",
      onClick: () => header.column.toggleVisibility(false),
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

  return (
    <div
      className={wrapperClassName}
      style={{ ...style, height, width: header.getSize() }}
    >
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
        </>
      )}
    </div>
  );
};
