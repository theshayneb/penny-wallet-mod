import { tn, t } from '../i18n'
import { formatAmount } from '../utils'
import type { BudgetUsage, MonthProgress } from '../budget'

/**
 * Budget name, "spent of amount", a progress bar and the left/over line.
 * With `progress` (current month only) a marker shows how much of the month
 * has passed, so spending ahead of pace is visible at a glance.
 */
export function renderBudgetProgress(
  container: HTMLElement,
  usage: BudgetUsage,
  dp: 0 | 2,
  progress: MonthProgress | null = null,
): HTMLElement {
  const over = usage.remaining < 0
  const el = container.createDiv('pw-budget-progress' + (over ? ' is-over' : ''))

  const head = el.createDiv('pw-budget-row-head')
  head.createSpan({ text: usage.budget.name, cls: 'pw-budget-name' })
  head.createSpan({
    text: tn('dash.budgetSpentOf', {
      spent: formatAmount(usage.spent, dp),
      amount: formatAmount(usage.budget.amount, dp),
    }),
    cls: 'pw-budget-spent',
  })

  const bar = el.createDiv('pw-budget-bar')
  const fill = bar.createDiv('pw-budget-bar-fill')
  fill.style.width = `${(usage.ratio * 100).toFixed(1)}%`
  if (progress && !over && usage.ratio > progress.elapsedRatio) fill.addClass('is-ahead')
  if (progress) {
    const marker = bar.createDiv('pw-budget-bar-marker')
    marker.style.left = `${(progress.elapsedRatio * 100).toFixed(1)}%`
    marker.setAttribute('aria-label', t('budget.todayMarker'))
  }

  el.createDiv({
    text: over
      ? tn('dash.budgetOver', { amount: formatAmount(-usage.remaining, dp) })
      : tn('dash.budgetRemaining', { amount: formatAmount(usage.remaining, dp) }),
    cls: 'pw-budget-remaining',
  })
  return el
}
