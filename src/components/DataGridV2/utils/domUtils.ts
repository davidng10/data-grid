/**
 * The grid's keyboard navigation focuses the cell whose `tabIndex=0`. Roving
 * tab-index makes that cell unique per render. To bring it into view (and
 * focus it), we query the live DOM for the first descendant with
 * `tabindex="0"` rather than threading refs down the tree — refs across
 * memoized rows would defeat the memo discipline.
 */

export function scrollIntoView(
  element: Element | null | undefined,
  behavior: ScrollBehavior = "instant",
) {
  element?.scrollIntoView({ inline: "nearest", block: "nearest", behavior });
}

export function getCellToScroll(gridEl: HTMLDivElement) {
  return gridEl.querySelector<HTMLDivElement>(
    '& > [role="row"] > [tabindex="0"]',
  );
}

function focusElement(element: HTMLDivElement | null, shouldScroll: boolean) {
  if (element === null) return;
  if (shouldScroll) scrollIntoView(element);
  element.focus({ preventScroll: true });
}

export function focusCell(gridEl: HTMLDivElement, shouldScroll = true) {
  focusElement(getCellToScroll(gridEl), shouldScroll);
}
