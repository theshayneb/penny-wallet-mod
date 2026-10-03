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

const WIKILINK_RE = /\[\[([^[\]]+?)\]\]/g

// Split a note into plain-text and [[wikilink]] segments.
// Supports [[target]], [[target|alias]] and the table-escaped [[target\|alias]].
export function parseNoteSegments(note: string): NoteSegment[] {
  const segments: NoteSegment[] = []
  let last = 0
  for (const m of note.matchAll(WIKILINK_RE)) {
    const inner = m[1]
    const pipe = inner.search(/\\?\|/)
    const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim()
    if (target === '') continue
    const alias = pipe === -1 ? '' : inner.slice(pipe).replace(/^\\?\|/, '').trim()
    if (m.index > last) segments.push({ kind: 'text', text: note.slice(last, m.index) })
    segments.push({ kind: 'link', target, text: alias || target })
    last = m.index + m[0].length
  }
  if (last < note.length) segments.push({ kind: 'text', text: note.slice(last) })
  return segments
}
