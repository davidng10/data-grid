import { useState } from "react";

/**
 * Roving-tabindex helper for grid cells.
 *
 * Follows the WAI-ARIA authoring-practices grid pattern: only the active cell
 * participates in the document's tab order; all other cells are `tabindex=-1`
 * and reached via arrow keys. When a cell contains focusable children, focus
 * delegates to the first such child instead of the cell itself.
 *
 * Refs:
 * - https://www.w3.org/WAI/ARIA/apg/patterns/grid/#keyboardinteraction-settingfocusandnavigatinginsidecells
 * - https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_general_within
 */
export function useRovingTabIndex(isActive: boolean) {
  const [isChildFocused, setIsChildFocused] = useState(false);

  // If this cell is no longer active, drop the "child focused" flag so the
  // parent's tabindex is recomputed correctly on the next active cell.
  if (isChildFocused && !isActive) {
    setIsChildFocused(false);
  }

  function onFocus(event: React.FocusEvent<HTMLDivElement>) {
    // Only retarget when the cell itself received focus (not a focusable child).
    if (event.target === event.currentTarget) {
      const elementToFocus = event.currentTarget.querySelector<
        Element & HTMLOrSVGElement
      >('[tabindex="0"]');

      if (elementToFocus !== null) {
        elementToFocus.focus({ preventScroll: true });
        setIsChildFocused(true);
      } else {
        setIsChildFocused(false);
      }
    } else {
      setIsChildFocused(true);
    }
  }

  const isFocusable = isActive && !isChildFocused;

  return {
    tabIndex: isFocusable ? 0 : -1,
    childTabIndex: isActive ? 0 : -1,
    onFocus: isActive ? onFocus : undefined,
  };
}
