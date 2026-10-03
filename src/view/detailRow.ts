import type { Transaction } from '../types'
import { formatAmount } from '../utils'

export interface Line3Display {
  tags: string[]
  note: string   // trimmed; '' when absent
}

export function isRefund(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.amount < 0
}

export function buildWalletText(tx: Transaction): string {
  if (tx.wallet) return tx.wallet
  if (tx.fromWallet && tx.toWallet) return `${tx.fromWallet} → ${tx.toWallet}`
  return '—'
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
