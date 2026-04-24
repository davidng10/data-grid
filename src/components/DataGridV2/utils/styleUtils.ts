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
