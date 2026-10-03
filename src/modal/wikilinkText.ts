export interface WikilinkQuery {
  start: number  // index of the opening "[["
  query: string  // text typed after "[[" up to the caret
}

/**
 * The unfinished [[link the caret is in, if any. A link already closed with
 * "]]", or one where an alias ("|") has started, doesn't count.
 */
export function findWikilinkQuery(value: string, caret: number): WikilinkQuery | null {
  const before = value.slice(0, caret)
  const start = before.lastIndexOf('[[')
  if (start === -1) return null
  const query = before.slice(start + 2)
  if (query.includes(']]') || query.includes('|') || query.includes('[') || query.includes('\n')) return null
  return { start, query }
}

/**
 * Replace the unfinished link with [[linktext]]. A "]]" right after the caret
 * (typed or auto-closed) is consumed so it isn't doubled. Returns the new
 * value and the caret position just after the inserted link.
 */
export function insertWikilink(
  value: string,
  caret: number,
  start: number,
  linktext: string,
): { value: string; caret: number } {
  let end = caret
  const rest = value.slice(caret)
  const close = rest.indexOf(']]')
  // Also swallow the rest of a half-typed name, e.g. caret in "[[mo|m]]"
  if (close !== -1 && !/[[\]|\n]/.test(rest.slice(0, close))) end = caret + close + 2
  const link = `[[${linktext}]]`
  return { value: value.slice(0, start) + link + value.slice(end), caret: start + link.length }
}
