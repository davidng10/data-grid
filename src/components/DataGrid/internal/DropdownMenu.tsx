import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "../DataGrid.module.css";

export type DropdownMenuItem = {
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

type DropdownMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  items: DropdownMenuItem[];
};

export function DropdownMenu({
  open,
  onClose,
  anchorRef,
  items,
}: DropdownMenuProps) {
  const menuRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
    setFocused(() => {
      for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
      return 0;
    });
  }, [open, anchorRef, items]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        setFocused((f) => {
          let next = f;
          for (let i = 0; i < items.length; i++) {
            next = (next + dir + items.length) % items.length;
            if (!items[next].disabled) return next;
          }
          return f;
        });
        return;
      }
      if (e.key === "Enter") {
        const item = items[focused];
        if (item && !item.disabled) {
          item.onClick();
          onClose();
        }
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, focused, items, onClose]);

  if (!open || !position) return null;
  return createPortal(
    <ul
      ref={menuRef}
      className={styles.dropdownMenu}
      role="menu"
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item, i) => (
        <li
          key={item.label}
          role="menuitem"
          aria-disabled={item.disabled ? true : undefined}
          title={item.disabled ? item.disabledReason : undefined}
          className={clsx(
            styles.dropdownItem,
            item.disabled && styles.dropdownItemDisabled,
            !item.disabled && i === focused && styles.dropdownItemFocused,
          )}
          onMouseEnter={() => !item.disabled && setFocused(i)}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </li>
      ))}
    </ul>,
    document.body,
  );
}
