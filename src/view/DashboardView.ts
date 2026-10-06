import { Events, ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { t, tn, formatMonthLabel, formatYearMonth } from '../i18n'
import { currentYearMonth, tagKey } from '../utils'
import { computeBudgetUsage, getMonthProgress } from '../budget'
import { renderBudgetProgress } from './budgetComponents'
import { renderCard } from './components'
import { Transaction, TransactionType } from '../types'
import { DETAIL_VIEW_TYPE } from './DetailView'
import { renderSharedHeader, switchView } from './SharedHeader'
import { openTransactionEditor, renderNoteWithLinks, renderTransactionRow } from './txShared'
import { Chart } from 'chart.js'
import { MonthData, drawExpenseChart, drawPie, getMonthRangeEndingAt } from './charts'

export const DASHBOARD_VIEW_TYPE = 'penny-wallet-mod-dashboard'

export class DashboardView extends ItemView {
  private walletFile: WalletFile
  private currentYearMonth: string
  private charts: Chart[] = []

  private clearCharts() {
    this.charts.forEach(c => c.destroy())
    this.charts = []
  }

  constructor(leaf: WorkspaceLeaf, walletFile: WalletFile) {
    super(leaf)
    this.walletFile = walletFile
    this.currentYearMonth = currentYearMonth()
  }

  getViewType() { return DASHBOARD_VIEW_TYPE }
  getDisplayText() { return t('dashboard.title') }
  getIcon() { return 'wallet' }

  async setState(state: Record<string, unknown>, result: ViewStateResult) {
    if (state?.yearMonth) this.currentYearMonth = state.yearMonth as string
    await super.setState(state, result)
    await this.render()
  }

  async onOpen() {
    this.registerEvent(
      (this.app.workspace as Events).on('penny-wallet-mod:refresh', () => { void this.render() })
    )
    this.registerEvent(
      (this.app.workspace as Events).on('css-change', () => { void this.render() })
    )
    await this.render()
  }

  onClose(): Promise<void> {
    this.clearCharts()
    this.contentEl.empty()
    return Promise.resolve()
  }

  async render() {
    const { contentEl } = this
    this.clearCharts()
    contentEl.empty()
    contentEl.addClass('pw-dashboard')

    const months = getMonthRangeEndingAt(this.currentYearMonth, 6)

    const followUpTag = (this.walletFile.getConfig().followUpTag ?? '').trim()
    const [transactions, summaries, followUps] = await Promise.all([
      this.walletFile.readMonth(this.currentYearMonth),
      this.walletFile.getMonthSummaries(months),
      followUpTag ? this.walletFile.findTransactionsByTag(followUpTag) : Promise.resolve(null),
    ])

    renderSharedHeader(contentEl, {
      view: this,
      walletFile: this.walletFile,
      activeView: 'dashboard',
      yearMonth: this.currentYearMonth,
      onMonthChange: (ym) => { this.currentYearMonth = ym; void this.render() },
    })

    const dp = this.walletFile.getConfig().decimalPlaces ?? 0

    // ── 6-month expense chart ────────────────────────────────────────────────
    const data: MonthData[] = months.map(ym => ({
      monthLabel: formatMonthLabel(ym),
      tooltipLabel: formatYearMonth(ym, 'short'),
      expense: summaries.get(ym)?.expense ?? 0,
    }))

    // ── 2-column grid: budgets + bar chart left, pie charts right ───────────
    const grid2 = contentEl.createDiv('pw-grid-2')
    const gridLeft = grid2.createDiv('pw-grid-left')

    // Budgets with the follow-up list beside them (they wrap when the column is narrow)
    const hasBudgets = (this.walletFile.getConfig().budgets ?? []).length > 0
    if (hasBudgets || followUps) {
      const topRow = gridLeft.createDiv('pw-left-top')
      if (hasBudgets) this.renderBudgets(topRow, transactions, dp)
      if (followUps) this.renderFollowUps(topRow, followUpTag, followUps, dp)
    }

    const incExpCard = renderCard(gridLeft, {
      title: t('trend.monthlyExpense'),
      className: 'pw-inc-exp-card',
    })
    const incExpChartWrap = incExpCard.createDiv('pw-chart-wrap')
    this.charts.push(drawExpenseChart(incExpChartWrap, data, dp))

    // ── Category pies ────────────────────────────────────────────────────────
    const gridRight = grid2.createDiv('pw-grid-right')

    const expenseMap = this.walletFile.groupByCategory(transactions, 'expense')
    const tagMap     = this.walletFile.groupExpensesByTag(transactions, this.walletFile.getConfig().chartExcludedTags ?? [])

    const expCard = renderCard(gridRight, { title: t('dash.expenseByCategory') })
    if (expenseMap.size > 0) this.charts.push(drawPie(expCard, expenseMap, dp, (cat) => { void this.openDetailWithFilter('expense', cat) }, 200))
    else expCard.createEl('p', { text: t('dash.noData'), cls: 'pw-no-data' })

    const tagCard = renderCard(gridRight, { title: t('dash.expenseByTag') })
    if (tagMap.size > 0) {
      this.charts.push(drawPie(tagCard, tagMap, dp, (tag) => { void this.openDetailWithTag(tag) }, 200,
        (tag) => tag ? `#${tag}` : t('dash.untagged')))
    } else {
      tagCard.createEl('p', { text: t('dash.noData'), cls: 'pw-no-data' })
    }

  }

  private renderBudgets(parent: HTMLElement, transactions: Transaction[], dp: 0 | 2) {
    const budgets = this.walletFile.getConfig().budgets ?? []
    const card = renderCard(parent, { title: t('dash.budgets'), className: 'pw-budget-card pw-dash-budget-card' })
    const progress = getMonthProgress(this.currentYearMonth)
    for (const usage of computeBudgetUsage(budgets, transactions)) {
      const row = renderBudgetProgress(card, usage, dp, progress)
      row.addClass('pw-budget-row')
      row.dataset['testid'] = 'budget-row'
      row.setAttribute('role', 'button')
      row.tabIndex = 0

      const open = () => { void this.openDetailWithBudget(usage.budget.name) }
      row.addEventListener('click', open)
      row.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        open()
      })
    }
  }

  /** All transactions with the follow-up tag (any month); click a row to edit it. */
  private renderFollowUps(
    parent: HTMLElement,
    tag: string,
    items: { tx: Transaction; yearMonth: string }[],
    dp: 0 | 2,
  ) {
    const card = renderCard(parent, { className: 'pw-follow-up-card' })
    card.dataset['testid'] = 'follow-up-card'
    const head = card.createDiv('pw-card-title pw-follow-up-title')
    head.createSpan({ text: t('dash.followUps') })
    head.createSpan({ text: `#${tag} · ${items.length}`, cls: 'pw-follow-up-count' })

    if (items.length === 0) {
      card.createEl('p', { text: tn('dash.noFollowUps', { tag }), cls: 'pw-no-data' })
      return
    }

    const list = card.createDiv('pw-follow-up-list')
    const thisYear = currentYearMonth().slice(0, 4)
    for (const { tx, yearMonth } of items) {
      const year = yearMonth.slice(0, 4)
      const row = renderTransactionRow(list, tx, {
        dp,
        // Follow-ups span months; show the year only when it isn't this year
        dateText: year === thisYear ? tx.date : `${year}/${tx.date}`,
        renderNote: (el, note) => renderNoteWithLinks(el, note, {
          app: this.app,
          sourcePath: this.walletFile.monthFilePath(yearMonth),
          hoverParent: this,
          source: DASHBOARD_VIEW_TYPE,
        }),
        onClick: () => openTransactionEditor(this.app, this.walletFile, tx, yearMonth),
      })
      row.dataset['testid'] = 'follow-up-row'
      // Every row has the follow-up tag; only show the others
      row.querySelectorAll<HTMLElement>('.pw-tx-tag-chip').forEach(chip => {
        if (tagKey(chip.dataset['tag'] ?? '') === tagKey(tag)) chip.remove()
      })
      row.querySelectorAll('.pw-tx-row-line4').forEach(line => {
        if (!line.querySelector('.pw-tx-tag-chip')) line.remove()
      })
    }
  }

  /** '' (untagged or "Other") opens all of the month's expenses. */
  private async openDetailWithTag(tag: string) {
    await switchView(this, DETAIL_VIEW_TYPE, { yearMonth: this.currentYearMonth, filterType: 'expense', ...(tag ? { filterTag: tag } : {}), resetFilters: true })
  }

  private async openDetailWithBudget(budget: string) {
    await switchView(this, DETAIL_VIEW_TYPE, { yearMonth: this.currentYearMonth, filterBudget: budget, resetFilters: true })
  }

  private async openDetailWithFilter(type: TransactionType, category: string) {
    await switchView(this, DETAIL_VIEW_TYPE, { yearMonth: this.currentYearMonth, filterType: type, filterCategory: category, resetFilters: true })
  }
}
