import { describe, it, expect } from 'vitest'
import { computeBudgetUsage, validateBudgetName } from '../../src/budget'
import type { Budget, Transaction } from '../../src/types'

const tx = (over: Partial<Transaction>): Transaction => ({
  date: '05/01', type: 'expense', wallet: 'cash', category: 'food', note: '', amount: 0, ...over,
})

describe('computeBudgetUsage', () => {
  const budgets: Budget[] = [{ name: 'Groceries', amount: 500 }, { name: 'Fun', amount: 100 }]

  it('deducts assigned expenses from each budget', () => {
    const usage = computeBudgetUsage(budgets, [
      tx({ amount: 120, budget: 'Groceries' }),
      tx({ amount: 80, budget: 'Groceries' }),
      tx({ amount: 30, budget: 'Fun' }),
      tx({ amount: 999 }), // unbudgeted
    ])
    expect(usage.map(u => [u.budget.name, u.spent, u.remaining])).toEqual([
      ['Groceries', 200, 300],
      ['Fun', 30, 70],
    ])
    expect(usage[0].ratio).toBeCloseTo(0.4)
  })

  it('refunds add money back to the budget', () => {
    const [g] = computeBudgetUsage(budgets, [
      tx({ amount: 200, budget: 'Groceries' }),
      tx({ amount: -50, budget: 'Groceries' }),
    ])
    expect(g.spent).toBe(150)
    expect(g.remaining).toBe(350)
  })

  it('ignores non-expense transactions', () => {
    const [g] = computeBudgetUsage(budgets, [tx({ type: 'income', amount: 1000, budget: 'Groceries' })])
    expect(g.spent).toBe(0)
  })

  it('reports overspend as negative remaining with ratio capped at 1', () => {
    const [, fun] = computeBudgetUsage(budgets, [tx({ amount: 150, budget: 'Fun' })])
    expect(fun.remaining).toBe(-50)
    expect(fun.ratio).toBe(1)
  })

  it('zero-amount budget: ratio 0 when unused, 1 when spent', () => {
    const zero: Budget[] = [{ name: 'Z', amount: 0 }]
    expect(computeBudgetUsage(zero, [])[0].ratio).toBe(0)
    expect(computeBudgetUsage(zero, [tx({ amount: 1, budget: 'Z' })])[0].ratio).toBe(1)
  })
})

describe('validateBudgetName', () => {
  it('accepts a new name', () => {
    expect(validateBudgetName('Groceries', ['Fun'])).toBeNull()
  })
  it('rejects empty, pipe, dash and duplicates', () => {
    expect(validateBudgetName('', [])).toBe('err.budgetNameEmpty')
    expect(validateBudgetName('a|b', [])).toBe('err.budgetNameInvalid')
    expect(validateBudgetName('-', [])).toBe('err.budgetNameInvalid')
    expect(validateBudgetName('Fun', ['Fun'])).toBe('err.budgetNameDuplicate')
  })
})

import { computeBudgetTotals, getMonthProgress } from '../../src/budget'

describe('computeBudgetTotals', () => {
  const budgets: Budget[] = [{ name: 'Groceries', amount: 500 }, { name: 'Fun', amount: 100 }]

  it('sums budgets and collects unbudgeted expenses (incl. deleted budgets)', () => {
    const txs = [
      tx({ amount: 200, budget: 'Groceries' }),
      tx({ amount: 150, budget: 'Fun' }),
      tx({ amount: 40 }),
      tx({ amount: 10, budget: 'Deleted' }),
      tx({ type: 'income', amount: 1000 }),
    ]
    const totals = computeBudgetTotals(computeBudgetUsage(budgets, txs), txs)
    expect(totals).toEqual({
      budgeted: 600, spent: 350, remaining: 250, unbudgetedSpent: 50, unbudgetedCount: 2,
    })
  })
})

describe('getMonthProgress', () => {
  it('returns progress for the current month', () => {
    // 2026-04 has 30 days; on the 10th, 10/30 elapsed and 21 days left including today
    const p = getMonthProgress('2026-04', new Date(2026, 3, 10))
    expect(p?.elapsedRatio).toBeCloseTo(10 / 30)
    expect(p?.daysLeft).toBe(21)
  })
  it('last day of month → ratio 1, 1 day left', () => {
    expect(getMonthProgress('2026-02', new Date(2026, 1, 28))).toEqual({ elapsedRatio: 1, daysLeft: 1 })
  })
  it('returns null for other months', () => {
    expect(getMonthProgress('2026-03', new Date(2026, 3, 10))).toBeNull()
    expect(getMonthProgress('2025-04', new Date(2026, 3, 10))).toBeNull()
  })
})
