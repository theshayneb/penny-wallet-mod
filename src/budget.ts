import type { Budget, Transaction } from './types'

export interface BudgetUsage {
  budget: Budget
  spent: number      // expenses minus refunds assigned to this budget
  remaining: number  // budget.amount - spent; negative when over budget
  ratio: number      // spent / amount, clamped to [0, 1] for progress bars
}

/**
 * Monthly usage per configured budget. Only expense transactions count;
 * refunds (negative expense amounts) give money back to the budget.
 * Pass the transactions of a single month — budgets reset every month.
 */
export function computeBudgetUsage(budgets: readonly Budget[], transactions: readonly Transaction[]): BudgetUsage[] {
  const spentByName = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.budget) continue
    spentByName.set(tx.budget, (spentByName.get(tx.budget) ?? 0) + tx.amount)
  }
  return budgets.map(budget => {
    const spent = spentByName.get(budget.name) ?? 0
    const ratio = budget.amount > 0 ? Math.min(Math.max(spent / budget.amount, 0), 1) : (spent > 0 ? 1 : 0)
    return { budget, spent, remaining: budget.amount - spent, ratio }
  })
}

export type BudgetNameError = 'err.budgetNameEmpty' | 'err.budgetNameInvalid' | 'err.budgetNameDuplicate'

/** Budget names are stored in a markdown table cell, so `|` is not allowed. */
export function validateBudgetName(name: string, existing: readonly string[]): BudgetNameError | null {
  if (!name) return 'err.budgetNameEmpty'
  if (name.includes('|') || name === '-') return 'err.budgetNameInvalid'
  if (existing.includes(name)) return 'err.budgetNameDuplicate'
  return null
}
