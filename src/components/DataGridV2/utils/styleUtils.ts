type ClassValue = string | false | undefined | null;

/** Tiny `classnames`: concatenate truthy string args, space-separated. */
export function classnames(...args: readonly ClassValue[]): string {
  let out = "";
  for (const arg of args) {
    if (typeof arg === "string" && arg.length > 0) {
      out += ` ${arg}`;
    }
  }
  return out.slice(1);
}

const { max, min } = Math;

/**
 * Clamp a candidate column width to `[minWidth, maxWidth]`. Shared between
 * the layer-6 resize handle and `useCalculatedColumns`' metrics pass so a
 * width never lands in the template that the other code path would reject.
 */
export function clampColumnWidth(
  width: number,
  bounds: { readonly minWidth: number; readonly maxWidth: number | undefined },
): number {
  const { minWidth, maxWidth } = bounds;
  const clamped = max(width, minWidth);
  if (typeof maxWidth === "number" && maxWidth >= minWidth) {
    return min(clamped, maxWidth);
  }
  return clamped;
}
