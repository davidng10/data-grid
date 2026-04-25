import type { CellEvent } from "../types";

/**
 * Wraps a React synthetic event so consumers (`onCellKeyDown`, `onCellClick`)
 * can opt out of the grid's default handling for that event. Mirrors the
 * pattern in DataGridOs: the wrapper proxies the original event via a
 * prototype chain so all native `Event` methods continue to work.
 */
export function createCellEvent<E extends React.SyntheticEvent<HTMLDivElement>>(
  event: E,
): CellEvent<E> {
  let defaultPrevented = false;
  const cellEvent = {
    ...event,
    preventGridDefault() {
      defaultPrevented = true;
    },
    isGridDefaultPrevented() {
      return defaultPrevented;
    },
  };

  Object.setPrototypeOf(cellEvent, Object.getPrototypeOf(event));
  return cellEvent as CellEvent<E>;
}
