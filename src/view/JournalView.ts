import { App, CachedMetadata, Events, ItemView, WorkspaceLeaf, debounce, getAllTags } from 'obsidian'
import { Chart } from 'chart.js'
import { WalletFile } from '../io/WalletFile'
import { t, tn, formatMonthLabel, formatYearMonth, midSentence } from '../i18n'
import { tagKey } from '../utils'
import { renderCard } from './components'
import { OTHER_COLOR, assignCategoryColors, drawPie, getMonthRangeEndingAt, getThemeColors } from './charts'
import { MoodSeries, drawMoodShares, drawMoodTrend } from './journalCharts'
import {
  JournalEntry, JournalSettings, JournalValue, MoodBreakdown, SEASONS, WEEKDAYS,
  breakdownByGroup, buildEntry, countValues, entriesSince, findMoodLinks, orderMoods,
  overallBreakdown, seasonOf, streaks, yearMonthOf,
} from '../journal'

export const JOURNAL_VIEW_TYPE = 'penny-wallet-mod-journal'

type Range = '3m' | '6m' | '12m' | 'all'
const RANGES: Range[] = ['3m', '6m', '12m', 'all']
const RANGE_MONTHS: Record<Exclude<Range, 'all'>, number> = { '3m': 3, '6m': 6, '12m': 12 }

const MAX_TREND_MONTHS = 24
const MAX_GROUPS = 10      // rows per breakdown chart
const RECENT_LIMIT = 30

/** First letter upper-case, for titles built from property names. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function dateText(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Notes tagged `tag` (or a nested tag under it), as journal entries. */
export function readJournalEntries(app: App, tag: string, settings: JournalSettings): JournalEntry[] {
  const key = tagKey(tag)
  if (!key) return []
  const entries: JournalEntry[] = []
  for (const file of app.vault.getMarkdownFiles()) {
    const cache: CachedMetadata | null = app.metadataCache.getFileCache(file)
    if (!cache) continue
    const tags = getAllTags(cache) ?? []
    if (!tags.some(tg => { const k = tagKey(tg); return k === key || k.startsWith(key + '/') })) continue
    entries.push(buildEntry(
      { path: file.path, basename: file.basename, ctime: file.stat.ctime },
      cache.frontmatter as Record<string, unknown> | undefined,
      settings,
    ))
  }
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime() || a.path.localeCompare(b.path))
}

/**
 * Journal insights: how often each mood comes up and how it lines up with the
 * other properties, the weekday and the season. Laid out like the Overview.
 */
export class JournalView extends ItemView {
  private walletFile: WalletFile
  private range: Range = '12m'
  private charts: Chart[] = []
  private readonly pwScheduleRender = debounce(() => { void this.render() }, 1000, true)

  constructor(leaf: WorkspaceLeaf, walletFile: WalletFile) {
    super(leaf)
    this.walletFile = walletFile
  }

  getViewType() { return JOURNAL_VIEW_TYPE }
  getDisplayText() { return t('journal.title') }
  getIcon() { return 'smile' }

  getState(): Record<string, unknown> {
    return { ...super.getState(), range: this.range }
  }

  async setState(state: Record<string, unknown>, result: Parameters<ItemView['setState']>[1]) {
    if (RANGES.includes(state?.range as Range)) this.range = state.range as Range
    await super.setState(state, result)
    await this.render()
  }

  async onOpen() {
    this.registerEvent((this.app.workspace as Events).on('penny-wallet-mod:refresh', () => { void this.render() }))
    this.registerEvent((this.app.workspace as Events).on('css-change', () => { void this.render() }))
    // Re-read when notes change; debounced so typing in a journal note doesn't redraw constantly
    this.registerEvent(this.app.metadataCache.on('changed', () => this.pwScheduleRender()))
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.pwScheduleRender()))
    this.registerEvent(this.app.vault.on('delete', () => this.pwScheduleRender()))
    this.registerEvent(this.app.vault.on('rename', () => this.pwScheduleRender()))
    await this.render()
  }

  onClose(): Promise<void> {
    this.pwScheduleRender.cancel()
    this.clearCharts()
    this.contentEl.empty()
    return Promise.resolve()
  }

  private clearCharts() {
    this.charts.forEach(c => c.destroy())
    this.charts = []
  }

  private settings(): JournalSettings & { tag: string } {
    const config = this.walletFile.getConfig()
    return {
      tag: (config.journalTag ?? '').trim(),
      moodProperty: (config.journalMoodProperty ?? '').trim() || 'Mood',
      factorProperties: (config.journalFactorProperties ?? []).map(p => p.trim()).filter(Boolean),
      dateProperty: (config.journalDateProperty ?? '').trim() || 'date',
    }
  }

  private since(): Date | null {
    if (this.range === 'all') return null
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() - (RANGE_MONTHS[this.range] - 1), 1)
  }

  render(): Promise<void> {
    const { contentEl } = this
    const scrollTop = contentEl.scrollTop
    this.clearCharts()
    contentEl.empty()
    contentEl.addClass('pw-dashboard', 'pw-journal')

    const settings = this.settings()
    const all = readJournalEntries(this.app, settings.tag, settings)
    const entries = entriesSince(all, this.since())

    this.renderHeader(contentEl, settings.tag, entries.length)

    if (all.length === 0) {
      const card = renderCard(contentEl.createDiv('pw-journal-empty'))
      card.createEl('p', { text: tn('journal.noEntries', { tag: settings.tag || 'journal_entry' }), cls: 'pw-no-data' })
      return Promise.resolve()
    }

    const moodName = settings.moodProperty
    const moodTally = countValues(entries, e => e.mood)
    const moodOrder = orderMoods(moodTally)
    const moodLabels = new Map(moodTally.map(m => [m.key, m.label]))
    // Colors follow the display order, so numeric moods (1–5) get a stable ramp of colors
    const palette = getThemeColors().pie.filter(c => c !== OTHER_COLOR)
    const moodColors = assignCategoryColors(moodOrder, palette)
    const moods: MoodSeries[] = moodOrder.map(key => ({ key, label: moodLabels.get(key) ?? key, color: moodColors.get(key)! }))

    const grid = contentEl.createDiv('pw-grid-2')
    const left = grid.createDiv('pw-grid-left')
    const right = grid.createDiv('pw-grid-right')

    // ── Summary + recent entries ─────────────────────────────────────────────
    const topRow = left.createDiv('pw-left-top')
    this.renderSummary(topRow, entries, moodTally[0], moodName, moodColors)
    this.renderRecent(topRow, entries, settings, moodColors)

    if (moods.length === 0) {
      const card = renderCard(left)
      card.createEl('p', { text: tn('journal.noMood', { name: moodName }), cls: 'pw-no-data' })
    } else {
      // ── Breakdowns ─────────────────────────────────────────────────────────
      const overall = overallBreakdown(entries, t('journal.allEntries'))
      const weekdays = this.orderGroups(
        breakdownByGroup(entries, e => [{ key: String(e.date.getDay()), label: '' }]),
        WEEKDAYS.map(String), (key) => t(`journal.weekday.${key}` as Parameters<typeof t>[0]),
      )
      const seasons = this.orderGroups(
        breakdownByGroup(entries, e => [{ key: seasonOf(e.date), label: '' }]),
        SEASONS, (key) => t(`journal.season.${key}` as Parameters<typeof t>[0]),
      )
      const factorGroups = settings.factorProperties.map(prop => ({
        name: prop,
        groups: breakdownByGroup(entries, e => e.factors[prop] ?? [])
          .sort((a, b) => b.entries - a.entries || a.label.localeCompare(b.label)),
      }))

      const links = findMoodLinks([
        ...factorGroups,
        { name: t('journal.dimWeekday'), groups: weekdays },
        { name: t('journal.dimSeason'), groups: seasons },
      ], overall)
      this.renderLinks(left, links, moodName, moodLabels, moodColors)

      // Monthly trend, like the Overview's monthly expenses
      const trendCard = renderCard(left, {
        title: sentence(tn('journal.moodByMonth', { name: midSentence(moodName) })),
        className: 'pw-inc-exp-card',
      })
      this.renderMoodLegend(trendCard, moods)
      this.charts.push(drawMoodTrend(trendCard.createDiv('pw-chart-wrap'), this.trendMonths(entries, all), moods))

      const shareCard = (factor: string, groups: MoodBreakdown[]) => {
        const card = renderCard(left, {
          title: sentence(tn('journal.moodBy', { name: midSentence(moodName), factor: midSentence(factor) })),
          className: 'pw-journal-share-card',
        })
        if (groups.length === 0) {
          card.createEl('p', { text: t('journal.noValues'), cls: 'pw-no-data' })
          return
        }
        this.renderMoodLegend(card, moods)
        this.charts.push(drawMoodShares(card, [overall, ...groups.slice(0, MAX_GROUPS)], moods))
      }
      for (const f of factorGroups) shareCard(f.name, f.groups)
      shareCard(t('journal.dimWeekday'), weekdays)
      shareCard(t('journal.dimSeason'), seasons)
    }

    // ── Pies: how often each value comes up ──────────────────────────────────
    const pie = (title: string, tally: (JournalValue & { count: number })[], prop: string, colorFor?: (key: string) => string | undefined) => {
      const card = renderCard(right, { title })
      if (tally.length === 0) {
        card.createEl('p', { text: t('journal.noValues'), cls: 'pw-no-data' })
        return
      }
      const labels = new Map(tally.map(v => [v.key, v.label]))
      // Moods in display order; other properties most common first
      const order = colorFor ? moodOrder : tally.map(v => v.key)
      const counts = new Map(order.map(key => [key, tally.find(v => v.key === key)?.count ?? 0]))
      this.charts.push(drawPie(card, counts, 0,
        (key) => { if (key) this.searchFor(settings.tag, prop, labels.get(key) ?? key) },
        200, (key) => labels.get(key) ?? key, colorFor))
    }
    pie(moodName, moodTally, moodName, (key) => moodColors.get(key))
    for (const prop of settings.factorProperties) pie(prop, countValues(entries, e => e.factors[prop] ?? []), prop)

    contentEl.scrollTop = scrollTop
    return Promise.resolve()
  }

  private renderHeader(parent: HTMLElement, tag: string, count: number) {
    const root = parent.createDiv('pw-shared-header')
    const info = root.createDiv('pw-shared-header-month pw-journal-count')
    info.setText(tn('journal.headerCount', { tag, count: String(count) }))

    const tabs = root.createDiv('pw-shared-header-tabs')
    for (const range of RANGES) {
      const active = range === this.range
      const btn = tabs.createEl('button', {
        text: t(`journal.range.${range}`),
        cls: 'pw-shared-header-tab' + (active ? ' is-active' : ''),
      })
      if (!active) btn.addEventListener('click', () => { this.range = range; void this.render() })
    }
    root.createDiv('pw-shared-header-actions')
  }

  private renderSummary(
    parent: HTMLElement,
    entries: JournalEntry[],
    topMood: (JournalValue & { count: number }) | undefined,
    moodName: string,
    moodColors: Map<string, string>,
  ) {
    const card = renderCard(parent, { className: 'pw-journal-summary' })
    const stats = card.createDiv('pw-journal-stats')
    const stat = (label: string, value: string, sub?: string) => {
      const el = stats.createDiv('pw-metric pw-journal-stat')
      el.createDiv({ text: label, cls: 'pw-metric-label' })
      const valueEl = el.createDiv({ text: value, cls: 'pw-metric-value' })
      if (sub) el.createDiv({ text: sub, cls: 'pw-journal-stat-sub' })
      return valueEl
    }

    const days = new Set(entries.map(e => dateText(e.date))).size
    const since = this.since() ?? (entries.length ? entries[entries.length - 1].date : new Date())
    const spanDays = Math.max(1, Math.round((Date.now() - since.getTime()) / 86_400_000) + 1)
    stat(t('journal.entries'), String(entries.length),
      tn('journal.daysCovered', { pct: String(Math.min(100, Math.round((days / spanDays) * 100))) }))

    const { current, longest } = streaks(entries, new Date())
    const dayCount = (n: number) => tn(n === 1 ? 'journal.day' : 'journal.days', { count: String(n) })
    stat(t('journal.currentStreak'), dayCount(current))
    stat(t('journal.longestStreak'), dayCount(longest))

    if (topMood) {
      const withMood = entries.filter(e => e.mood.length > 0).length
      const valueEl = stat(sentence(tn('journal.topMood', { name: midSentence(moodName) })), topMood.label,
        tn('journal.entriesCount', { count: `${topMood.count} / ${withMood}` }))
      valueEl.addClass('pw-journal-top-mood')
      valueEl.setCssProps({ color: moodColors.get(topMood.key) ?? '' })
    }
  }

  /** Newest entries; click to open the note. */
  private renderRecent(parent: HTMLElement, entries: JournalEntry[], settings: JournalSettings, moodColors: Map<string, string>) {
    const card = renderCard(parent, { className: 'pw-follow-up-card pw-journal-recent' })
    const head = card.createDiv('pw-card-title pw-follow-up-title')
    head.createSpan({ text: t('journal.recent') })
    head.createSpan({ text: String(entries.length), cls: 'pw-follow-up-count' })

    if (entries.length === 0) {
      card.createEl('p', { text: t('journal.noValues'), cls: 'pw-no-data' })
      return
    }

    const list = card.createDiv('pw-follow-up-list')
    for (const e of entries.slice(0, RECENT_LIMIT)) {
      const row = list.createDiv('pw-journal-row')
      row.setAttribute('role', 'link')
      row.tabIndex = 0
      const top = row.createDiv('pw-journal-row-top')
      const date = dateText(e.date)
      top.createSpan({ text: `${date} · ${t(`journal.weekday.${e.date.getDay()}` as Parameters<typeof t>[0])}`, cls: 'pw-journal-row-date' })
      for (const m of e.mood) {
        const chip = top.createSpan({ cls: 'pw-journal-chip' })
        chip.createSpan({ cls: 'pw-legend-dot' }).setCssProps({ 'background-color': moodColors.get(m.key) ?? OTHER_COLOR })
        chip.createSpan({ text: m.label })
      }
      if (!e.title.includes(date)) row.createDiv({ text: e.title, cls: 'pw-journal-row-title' })
      const details = settings.factorProperties.flatMap(p => (e.factors[p] ?? []).map(v => v.label))
      if (details.length) row.createDiv({ text: details.join(' · '), cls: 'pw-journal-row-details' })

      // In a new tab, so the insights stay open
      const open = () => { void this.app.workspace.openLinkText(e.path, '', 'tab') }
      row.addEventListener('click', open)
      row.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return
        ev.preventDefault()
        open()
      })
    }
  }

  private renderLinks(
    parent: HTMLElement,
    links: ReturnType<typeof findMoodLinks>,
    moodName: string,
    moodLabels: Map<string, string>,
    moodColors: Map<string, string>,
  ) {
    const card = renderCard(parent, {
      title: sentence(tn('journal.links', { name: midSentence(moodName) })),
      className: 'pw-journal-links',
    })
    card.createDiv({ text: tn('journal.linksHint', { name: midSentence(moodName) }), cls: 'pw-journal-hint' })
    if (links.length === 0) {
      card.createEl('p', { text: t('journal.noLinks'), cls: 'pw-no-data' })
      return
    }
    for (const l of links) {
      const row = card.createDiv('pw-journal-link')
      const what = row.createDiv('pw-journal-link-group')
      what.createSpan({ text: `${sentence(l.dimension)}: `, cls: 'pw-journal-link-dim' })
      what.createSpan({ text: l.group })
      const chip = row.createSpan({ cls: 'pw-journal-chip' })
      chip.createSpan({ cls: 'pw-legend-dot' }).setCssProps({ 'background-color': moodColors.get(l.moodKey) ?? OTHER_COLOR })
      chip.createSpan({ text: moodLabels.get(l.moodKey) ?? l.moodKey })
      row.createSpan({
        text: tn('journal.linkShare', { share: String(Math.round(l.share * 100)), base: String(Math.round(l.baseline * 100)) }),
        cls: 'pw-journal-link-share',
      })
      row.createSpan({ text: tn('journal.entriesCount', { count: String(l.entries) }), cls: 'pw-journal-link-n' })
    }
  }

  private renderMoodLegend(parent: HTMLElement, moods: MoodSeries[]) {
    const legend = parent.createDiv('pw-journal-legend')
    for (const m of moods) {
      const item = legend.createSpan('pw-journal-chip')
      item.createSpan({ cls: 'pw-legend-dot' }).setCssProps({ 'background-color': m.color })
      item.createSpan({ text: m.label })
    }
  }

  /** Groups with fixed keys (weekdays, seasons) in their natural order, labelled. */
  private orderGroups(groups: MoodBreakdown[], order: string[], labelFor: (key: string) => string): MoodBreakdown[] {
    const byKey = new Map(groups.map(g => [g.key, g]))
    return order.flatMap(key => {
      const g = byKey.get(key)
      return g ? [{ ...g, label: labelFor(key) }] : []
    })
  }

  private trendMonths(entries: JournalEntry[], all: JournalEntry[]) {
    const now = yearMonthOf(new Date())
    let count: number
    if (this.range === 'all') {
      const first = all.length ? yearMonthOf(all[all.length - 1].date) : now
      const [fy, fm] = first.split('-').map(Number)
      const [ny, nm] = now.split('-').map(Number)
      count = Math.min(MAX_TREND_MONTHS, Math.max(1, (ny - fy) * 12 + (nm - fm) + 1))
    } else {
      count = RANGE_MONTHS[this.range]
    }
    const months = getMonthRangeEndingAt(now, count)
    const byMonth = new Map(breakdownByGroup(entries, e => [{ key: yearMonthOf(e.date), label: '' }]).map(g => [g.key, g]))
    return months.map(ym => ({
      label: formatMonthLabel(ym),
      tooltip: formatYearMonth(ym, 'short'),
      moods: byMonth.get(ym)?.moods ?? new Map<string, number>(),
      entries: byMonth.get(ym)?.entries ?? 0,
    }))
  }

  /** Opens Obsidian search for journal notes with this property value. */
  private searchFor(tag: string, prop: string, value: string) {
    const quote = (s: string) => /[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s
    const query = `tag:#${tag} [${quote(prop)}:${quote(value)}]`
    const search = (this.app as unknown as {
      internalPlugins?: { getPluginById(id: string): { instance?: { openGlobalSearch?(q: string): void } } | null }
    }).internalPlugins?.getPluginById('global-search')?.instance
    search?.openGlobalSearch?.(query)
  }
}
