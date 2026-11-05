import { App, Events, MarkdownPostProcessorContext, MarkdownRenderChild, TAbstractFile, debounce } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { t, tn, formatYearMonth } from '../i18n'
import { currentYearMonth } from '../utils'
import { computeBudgetUsage, getMonthProgress, parseBudgetEmbed } from '../budget'
import { renderBudgetProgress } from './budgetComponents'

export const BUDGET_EMBED_LANG = 'finance-budget'
/** Workspace event fired after transactions or settings change. */
export const BUDGET_EMBED_REFRESH = 'penny-wallet-mod:budget-embeds'

/** One budget's progress bar inside a note; redraws when transactions change. */
export class BudgetEmbed extends MarkdownRenderChild {
  private readonly refresh = debounce(() => { void this.render() }, 300, true)

  constructor(
    private app: App,
    containerEl: HTMLElement,
    private walletFile: WalletFile,
    private source: string,
    private openBudget: (name: string, yearMonth: string) => void,
  ) {
    super(containerEl)
  }

  onload() {
    const onFileChange = (file: TAbstractFile) => {
      if (file.path.startsWith(this.walletFile.folderName + '/')) this.refresh()
    }
    this.registerEvent(this.app.vault.on('modify', onFileChange))
    this.registerEvent(this.app.vault.on('create', onFileChange))
    this.registerEvent(this.app.vault.on('delete', onFileChange))
    this.registerEvent((this.app.workspace as Events).on('penny-wallet-mod:refresh', () => this.refresh()))
    this.registerEvent((this.app.workspace as Events).on(BUDGET_EMBED_REFRESH, () => this.refresh()))
    void this.render()
  }

  private async render() {
    const { name, yearMonth: fixedMonth } = parseBudgetEmbed(this.source)
    const yearMonth = fixedMonth ?? currentYearMonth()
    const budgets = this.walletFile.getConfig().budgets ?? []
    const budget = budgets.find(b => b.name === name)
      ?? budgets.find(b => b.name.toLowerCase() === name.toLowerCase())

    const el = this.containerEl
    el.empty()
    el.addClass('pw-budget-embed')

    if (!budget) {
      el.createDiv({
        text: name ? tn('embed.unknownBudget', { name }) : t('embed.noBudgetName'),
        cls: 'pw-budget-embed-error',
      })
      return
    }

    const transactions = await this.walletFile.readMonth(yearMonth)
    const [usage] = computeBudgetUsage([budget], transactions)
    const dp = this.walletFile.getConfig().decimalPlaces ?? 0
    const row = renderBudgetProgress(el, usage, dp, getMonthProgress(yearMonth))
    row.addClass('pw-budget-row')
    row.setAttribute('role', 'button')
    row.tabIndex = 0
    row.setAttribute('aria-label', tn('embed.openBudget', { name: budget.name }))
    if (fixedMonth && fixedMonth !== currentYearMonth()) {
      row.querySelector('.pw-budget-name')?.appendText(` · ${formatYearMonth(yearMonth, 'short')}`)
    }

    const open = () => this.openBudget(budget.name, yearMonth)
    row.addEventListener('click', open)
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      open()
    })
  }
}

export function processBudgetEmbed(
  app: App,
  walletFile: WalletFile,
  openBudget: (name: string, yearMonth: string) => void,
) {
  return (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    ctx.addChild(new BudgetEmbed(app, el, walletFile, source, openBudget))
  }
}
