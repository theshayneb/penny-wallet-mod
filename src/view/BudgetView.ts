import { Events, ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { t, tn, translateCategory } from '../i18n'
import { currentYearMonth, formatAmount } from '../utils'
import { Transaction } from '../types'
import { computeBudgetTotals, computeBudgetUsage, getMonthProgress, type BudgetUsage, type MonthProgress } from '../budget'
import { createMetric, renderCard } from './components'
import { renderBudgetProgress } from './budgetComponents'
import { renderSharedHeader } from './SharedHeader'
import { DETAIL_VIEW_TYPE } from './DetailView'
import { parseNoteSegments } from './detailRow'

export const BUDGET_VIEW_TYPE = 'penny-wallet-mod-budget'

const RECENT_LIMIT = 5

export class BudgetView extends ItemView {
  private walletFile: WalletFile
  private currentYearMonth: string

  constructor(leaf: WorkspaceLeaf, walletFile: WalletFile) {
    super(leaf)
    this.walletFile = walletFile
    this.currentYearMonth = currentYearMonth()
  }

  getViewType() { return BUDGET_VIEW_TYPE }
  getDisplayText() { return t('budget.title') }
  getIcon() { return 'piggy-bank' }

  async setState(state: Record<string, unknown>, result: ViewStateResult) {
    if (state?.yearMonth) this.currentYearMonth = state.yearMonth as string
    await super.setState(state, result)
    await this.render()
  }

  async onOpen() {
    this.registerEvent(
      (this.app.workspace as Events).on('penny-wallet-mod:refresh', () => { void this.render() })
    )
    await this.render()
  }

  onClose(): Promise<void> {
    this.contentEl.empty()
    return Promise.resolve()
  }

  async render() {
    const { contentEl } = this
    const transactions = await this.walletFile.readMonth(this.currentYearMonth)
    const savedScroll = contentEl.scrollTop
    contentEl.empty()
    contentEl.addClass('pw-budget-view')

    renderSharedHeader(contentEl, {
      view: this,
      walletFile: this.walletFile,
      activeView: 'budget',
      yearMonth: this.currentYearMonth,
      onMonthChange: (ym) => { this.currentYearMonth = ym; void this.render() },
    })

    const config = this.walletFile.getConfig()
    const dp = config.decimalPlaces ?? 0
    const budgets = config.budgets ?? []

    if (budgets.length === 0) {
      const empty = renderCard(contentEl.createDiv('pw-budget-body'), { className: 'pw-budget-empty' })
      empty.createEl('p', { text: t('budget.empty') })
      const btn = empty.createEl('button', { text: t('budget.openSettings'), cls: 'mod-cta' })
      btn.addEventListener('click', () => this.openSettings())
      return
    }

    const usages = computeBudgetUsage(budgets, transactions)
    const totals = computeBudgetTotals(usages, transactions)
    const progress = getMonthProgress(this.currentYearMonth)

    const metricsEl = contentEl.createDiv('pw-metrics')
    createMetric(metricsEl, t('budget.totalBudgeted'), totals.budgeted, 'neutral', { dp })
    createMetric(metricsEl, t('budget.totalSpent'), totals.spent, 'expense', { dp })
    createMetric(metricsEl, totals.remaining < 0 ? t('budget.totalOver') : t('budget.totalRemaining'),
      totals.remaining, totals.remaining < 0 ? 'negative' : 'positive', { dp, hero: true })

    const body = contentEl.createDiv('pw-budget-body')
    const grid = body.createDiv('pw-budget-grid')
    for (const usage of usages) {
      this.renderBudgetCard(grid, usage, transactions, dp, progress)
    }

    if (totals.unbudgetedCount > 0) {
      const card = renderCard(body, { title: t('budget.unbudgeted'), className: 'pw-budget-unbudgeted' })
      const row = card.createDiv('pw-budget-unbudgeted-row')
      row.createSpan({
        text: tn('budget.unbudgetedDesc', { count: String(totals.unbudgetedCount) }),
        cls: 'pw-budget-muted',
      })
      row.createSpan({ text: formatAmount(totals.unbudgetedSpent, dp), cls: 'pw-budget-unbudgeted-amount' })
    }

    contentEl.scrollTop = savedScroll
  }

  private renderBudgetCard(
    grid: HTMLElement,
    usage: BudgetUsage,
    transactions: Transaction[],
    dp: 0 | 2,
    progress: MonthProgress | null,
  ) {
    const card = renderCard(grid, { className: 'pw-budget-card' })
    card.dataset['testid'] = 'budget-card'
    renderBudgetProgress(card, usage, dp, progress)

    const pct = usage.budget.amount > 0 ? Math.round((usage.spent / usage.budget.amount) * 100) : null
    const stats = card.createDiv('pw-budget-stats')
    if (pct !== null) stats.createSpan({ text: tn('budget.percentUsed', { pct: String(pct) }) })
    if (progress && usage.remaining > 0) {
      stats.createSpan({
        text: tn('budget.perDay', {
          amount: formatAmount(usage.remaining / progress.daysLeft, dp),
          days: String(progress.daysLeft),
        }),
      })
    }

    const assigned = transactions
      .filter(tx => tx.type === 'expense' && tx.budget === usage.budget.name)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

    const list = card.createDiv('pw-budget-tx-list')
    if (assigned.length === 0) {
      list.createDiv({ text: t('budget.noTransactions'), cls: 'pw-budget-muted' })
      return
    }
    for (const tx of assigned.slice(0, RECENT_LIMIT)) {
      const row = list.createDiv('pw-budget-tx-row')
      row.createSpan({ text: tx.date, cls: 'pw-budget-tx-date' })
      const note = parseNoteSegments(tx.note).map(seg => seg.text).join('')
      row.createSpan({ text: note || translateCategory(tx.category ?? '') || '—', cls: 'pw-budget-tx-note' })
      row.createSpan({
        text: (tx.amount < 0 ? '+' : '-') + formatAmount(Math.abs(tx.amount), dp),
        cls: 'pw-budget-tx-amount' + (tx.amount < 0 ? ' is-refund' : ''),
      })
    }
    const viewAll = card.createEl('button', {
      text: tn('budget.viewAll', { count: String(assigned.length) }),
      cls: 'pw-budget-view-all',
    })
    viewAll.addEventListener('click', () => { void this.openDetailWithBudget(usage.budget.name) })
  }

  private openSettings() {
    const setting = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting
    setting.open()
    setting.openTabById('penny-wallet-mod')
  }

  private async openDetailWithBudget(budget: string) {
    const existing = this.app.workspace.getLeavesOfType(DETAIL_VIEW_TYPE)
    const leaf = existing[0] ?? this.app.workspace.getLeaf('tab')
    await leaf.setViewState({
      type: DETAIL_VIEW_TYPE,
      active: true,
      state: { yearMonth: this.currentYearMonth, filterBudget: budget, resetFilters: true },
    })
    void this.app.workspace.revealLeaf(leaf)
  }
}
