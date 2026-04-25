export function isCtrlKeyHeldDown(e: React.KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.key !== "Control";
}
