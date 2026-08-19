/** Return true when content exceeds the measured collapsed box. */
export function hasCollapsedOverflow(scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight > clientHeight + 1
}
