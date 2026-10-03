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

export interface BudgetTotals {
  budgeted: number
  spent: number
  remaining: number
  unbudgetedSpent: number  // expenses with no budget, or a budget that no longer exists
  unbudgetedCount: number
}

export function computeBudgetTotals(
  usages: readonly BudgetUsage[],
  transactions: readonly Transaction[],
): BudgetTotals {
  const names = new Set(usages.map(u => u.budget.name))
  let unbudgetedSpent = 0
  let unbudgetedCount = 0
  for (const tx of transactions) {
    if (tx.type !== 'expense' || (tx.budget && names.has(tx.budget))) continue
    unbudgetedSpent += tx.amount
    unbudgetedCount++
  }
  const budgeted = usages.reduce((sum, u) => sum + u.budget.amount, 0)
  const spent = usages.reduce((sum, u) => sum + u.spent, 0)
  return { budgeted, spent, remaining: budgeted - spent, unbudgetedSpent, unbudgetedCount }
}

export interface MonthProgress {
  elapsedRatio: number  // share of the month that has passed, including today (0–1]
  daysLeft: number      // days remaining including today
}

/** Progress through `yearMonth` ("yyyy-mm") as of `today`; null unless it is the current month. */
export function getMonthProgress(yearMonth: string, today: Date = new Date()): MonthProgress | null {
  const [y, m] = yearMonth.split('-').map(Number)
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return null
  const daysInMonth = new Date(y, m, 0).getDate()
  const day = today.getDate()
  return { elapsedRatio: day / daysInMonth, daysLeft: daysInMonth - day + 1 }
}
