import type { Transaction } from '../types'
import { formatAmount } from '../utils'

export interface Line3Display {
  tags: string[]
  note: string   // trimmed; '' when absent
}

export function isRefund(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.amount < 0
}

export function buildAmountDisplay(
  tx: Transaction,
  dp: 0 | 2 = 0,
): { text: string; className: string } {
  const refund = isRefund(tx)
  const className = refund
    ? 'pw-tx-amount is-refund'
    : tx.type === 'income'  ? 'pw-tx-amount is-income'
    : tx.type === 'expense' ? 'pw-tx-amount is-expense'
    : 'pw-tx-amount'
  const prefix = refund
    ? '+'
    : tx.type === 'expense' ? '-'
    : tx.type === 'income'  ? '+'
    : ''
  const displayAmount = refund ? -tx.amount : tx.amount
  return { text: prefix + formatAmount(displayAmount, dp), className }
}

export function buildLine3Display(tx: Transaction): Line3Display {
  return {
    tags: tx.tags ?? [],
    note: tx.note?.trim() ?? '',
  }
}

export type NoteSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; target: string; text: string }
  | { kind: 'url'; href: string; text: string }

// [[wikilink]], [text](target) or a bare http(s) URL
const LINK_RE = /\[\[([^[\]]+?)\]\]|\[([^[\]]+)\]\(([^()\s]+)\)|(https?:\/\/[^\s<>()[\]]*[^\s<>()[\].,;:!?'"])/g

const SAFE_SCHEME_RE = /^(https?|mailto|tel|obsidian):/i
const ANY_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
// "www.example.com" or "example.com/page": a website, not a note
const DOMAIN_RE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i

/**
 * Where a markdown link's target points: an external href (scheme added to bare
 * domains), a note to open, or null for a scheme we don't follow (e.g. javascript:).
 */
export function resolveMarkdownLinkTarget(target: string): { href: string } | { note: string } | null {
  if (SAFE_SCHEME_RE.test(target)) return { href: target }
  if (ANY_SCHEME_RE.test(target)) return null
  if (DOMAIN_RE.test(target) && !/\.md$/i.test(target.split(/[#/]/)[0] ?? '')) return { href: `https://${target}` }
  let note = target
  try { note = decodeURIComponent(target) } catch { /* keep as written */ }
  return { note: note.replace(/\.md(?=#|$)/i, '') }
}

// Split a note into plain-text, [[wikilink]] and external link segments.
// Supports [[target]], [[target|alias]] and the table-escaped [[target\|alias]],
// markdown links [text](https://… or www.… or Note) and bare https:// URLs.
export function parseNoteSegments(note: string): NoteSegment[] {
  const segments: NoteSegment[] = []
  let last = 0
  for (const m of note.matchAll(LINK_RE)) {
    let seg: NoteSegment | null = null
    if (m[1] !== undefined) {
      const inner = m[1]
      const pipe = inner.search(/\\?\|/)
      const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim()
      if (target === '') continue
      const alias = pipe === -1 ? '' : inner.slice(pipe).replace(/^\\?\|/, '').trim()
      seg = { kind: 'link', target, text: alias || target }
    } else if (m[2] !== undefined) {
      const resolved = resolveMarkdownLinkTarget(m[3])
      if (!resolved) continue
      seg = 'href' in resolved
        ? { kind: 'url', href: resolved.href, text: m[2] }
        : { kind: 'link', target: resolved.note, text: m[2] }
    } else {
      seg = { kind: 'url', href: m[4], text: m[4] }
    }
    if (m.index > last) segments.push({ kind: 'text', text: note.slice(last, m.index) })
    segments.push(seg)
    last = m.index + m[0].length
  }
  if (last < note.length) segments.push({ kind: 'text', text: note.slice(last) })
  return segments
}
