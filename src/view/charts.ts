import { formatAmount } from '../utils'
import { t, translateCategory } from '../i18n'
import {
  Chart,
  BarElement, BarController,
  LineElement, LineController, PointElement,
  ArcElement, PieController,
  CategoryScale, LinearScale,
  Tooltip, Legend,
  type ChartConfiguration,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

Chart.register(
  BarElement, BarController,
  LineElement, LineController, PointElement,
  ArcElement, PieController,
  CategoryScale, LinearScale,
  Tooltip, Legend,
  ChartDataLabels,
)

export interface MonthData {
  monthLabel: string
  tooltipLabel: string
  byCategory: ReadonlyMap<string, number>  // expense total per category key
}

// ─── Color helpers ────────────────────────────────────────────────────────────

export function getThemeColors() {
  const s = getComputedStyle(document.body)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  const dark = document.body.classList.contains('theme-dark')
  return {
    income:  v('--pw-income',  '#5DCAA5'),
    expense: v('--pw-expense', '#EF9F27'),
    net:     v('--pw-payment', '#AFA9EC'),
    muted:   dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
    label:   dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
    grid:    dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    pie: [
      ['--pw-expense', '#EF9F27'], ['--pw-bank', '#378ADD'], ['--pw-payment', '#AFA9EC'], ['--pw-cash', '#1D9E75'],
      ['--pw-income', '#5DCAA5'], ['--pw-transfer', '#85B7EB'], ['--pw-credit', '#D85A30'],
      '#D4537E', '#E3C34B', '#7F5BD5', '#9C6B3E', OTHER_COLOR,
    ].map(entry => Array.isArray(entry) ? v(entry[0], entry[1]) : entry),
  }
}

/** Neutral color for the pie's grouped "Other" slice; last in the pie palette. */
export const OTHER_COLOR = '#888780'

/**
 * Category keys ordered by total spending across the given months (largest
 * first, ties by key), so colors and stacking order stay stable across charts.
 */
export function rankCategories(perMonth: ReadonlyArray<ReadonlyMap<string, number>>): string[] {
  const totals = new Map<string, number>()
  for (const month of perMonth) {
    for (const [key, value] of month) totals.set(key, (totals.get(key) ?? 0) + Math.max(value, 0))
  }
  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key)
}

/** One color per category, in rank order, cycling through `palette` (which excludes OTHER_COLOR). */
export function assignCategoryColors(rankedKeys: readonly string[], palette: readonly string[]): Map<string, string> {
  return new Map(rankedKeys.map((key, i) => [key, palette[i % palette.length]]))
}

export function formatK(n: number, dp: 0 | 2 = 0): string {
  return Math.abs(n) >= 10000
    ? (n / 1000).toFixed(0) + 'k'
    : Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns last `count` months ending at (and including) `endYearMonth`. */
export function getMonthRangeEndingAt(endYearMonth: string, count: number): string[] {
  const [y, m] = endYearMonth.split('-').map(Number)
  const result: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

// ─── Monthly expense bar chart ────────────────────────────────────────────────

/**
 * Monthly expense bars stacked by category (income is not tracked on the
 * Overview). `categories` sets the stacking order (bottom first) and colors;
 * each bar is labelled with its total and the tooltip lists its categories.
 */
export function drawExpenseChart(
  container: HTMLElement,
  data: MonthData[],
  dp: 0 | 2,
  categories: { key: string; label: string; color: string }[],
): Chart {
  const colors = getThemeColors()
  const canvas = container.createEl('canvas')

  const values = categories.map(c => data.map(d => Math.max(d.byCategory.get(c.key) ?? 0, 0)))
  const totals = data.map((_, i) => values.reduce((sum, series) => sum + series[i], 0))
  // Index of the top (last non-empty) segment of each bar, which carries the total label
  const topIndex = data.map((_, i) => {
    for (let c = values.length - 1; c >= 0; c--) if (values[c][i] > 0) return c
    return -1
  })

  const cfg: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: data.map(d => d.monthLabel),
      datasets: categories.map((c, ci) => ({
        label: c.label,
        data: values[ci],
        backgroundColor: c.color,
        borderWidth: 0,
        maxBarThickness: 56,
        stack: 'expense',
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Room above the tallest bar for its total label
      layout: { padding: { top: 18 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => (item.raw as number) > 0,
          itemSort: (a, b) => b.datasetIndex - a.datasetIndex,  // top segment first, like the bar
          callbacks: {
            title: (items) => data[items[0].dataIndex].tooltipLabel,
            label: (ctx) => `${ctx.dataset.label ?? ''}: ${formatK(ctx.raw as number, dp)}`,
            footer: (items) => items.length ? `${t('dash.expense')}: ${formatK(totals[items[0].dataIndex], dp)}` : '',
          },
        },
        datalabels: {
          color: colors.label,
          clip: false,
          anchor: 'end',
          align: 'top',
          offset: 2,
          display: (ctx) => ctx.datasetIndex === topIndex[ctx.dataIndex],
          formatter: (_v: number, ctx) => formatK(totals[ctx.dataIndex], dp),
          font: { size: 10, weight: 'bold' },
        },
      },
      scales: {
        x: {
          stacked: true,
          border: { display: false },
          grid: { display: false },
          ticks: { color: colors.muted },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          border: { display: false },
          grid: { color: colors.grid },
          ticks: {
            color: colors.muted,
            maxTicksLimit: 6,
            callback: (v) => {
              const n = v as number
              return n === 0 ? '0' : formatK(n, dp)
            },
          },
        },
      },
    },
  }

  return new Chart(canvas, cfg)
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

export function filterPieData(data: Map<string, number>): Map<string, number> {
  if (data.size === 0) return new Map()
  const total = [...data.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return new Map()

  const filtered = new Map<string, number>()
  let otherTotal = 0

  for (const [key, value] of data) {
    if ((value / total) * 100 >= 1) {
      filtered.set(key, value)
    } else {
      otherTotal += value
    }
  }
  if (otherTotal > 0) filtered.set('__other__', otherTotal)
  return filtered
}

export function drawPie(
  container: HTMLElement,
  data: Map<string, number>,
  dp: 0 | 2 = 0,
  onSegmentClick?: (categoryKey: string) => void,
  size = 200,
  labelFor: (key: string) => string = translateCategory,
  colorFor?: (key: string) => string | undefined,  // fixed per-key colors; otherwise by position
): Chart {
  const filtered = filterPieData(data)
  const total = [...filtered.values()].reduce((a, b) => a + b, 0)

  const segments: { key: string; label: string; value: number }[] = []
  for (const [key, value] of filtered) {
    segments.push({
      key,
      label: key === '__other__' ? t('label.cat.other') : labelFor(key),
      value,
    })
  }

  const colors = getThemeColors()
  const segColors = segments.map((s, i) =>
    (s.key === '__other__' && colorFor ? OTHER_COLOR : colorFor?.(s.key)) ?? colors.pie[i % colors.pie.length])

  const wrap = container.createDiv('pw-pie-wrap')
  // Fixed-size wrapper lets Chart.js use responsive:true while keeping a stable size.
  // This ensures touch-event coordinates are computed correctly on mobile.
  const canvasWrap = wrap.createDiv('pw-pie-canvas-wrap')
  canvasWrap.style.width  = `${size}px`
  canvasWrap.style.height = `${size}px`
  if (onSegmentClick) canvasWrap.setCssProps({ cursor: 'pointer' })
  const canvas = canvasWrap.createEl('canvas')

  const chart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: segments.map(s => s.label),
      datasets: [{
        data: segments.map(s => s.value),
        backgroundColor: segColors,
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        hoverOffset: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 8 },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => segments[items[0].dataIndex].label,
            label: (ctx) => {
              const seg = segments[ctx.dataIndex]
              const pct = Math.round((seg.value / total) * 100)
              return `${formatAmount(seg.value, dp)} (${pct}%)`
            },
          },
        },
      },
      onClick: onSegmentClick
        ? (_, elements) => {
            if (!elements.length) return
            const seg = segments[elements[0].index]
            // __other__ navigates with no category filter (shows all of that type)
            onSegmentClick(seg.key === '__other__' ? '' : seg.key)
          }
        : undefined,
    },
  })

  // HTML legend — inherits theme text color, supports click navigation
  const legend = wrap.createDiv('pw-pie-legend')
  segments.forEach((seg, i) => {
    const item = legend.createDiv('pw-legend-item')
    if (onSegmentClick) {
      item.setCssProps({ cursor: 'pointer' })
      item.addEventListener('click', () => onSegmentClick(seg.key === '__other__' ? '' : seg.key))
    }
    const dot = item.createEl('span', { cls: 'pw-legend-dot' })
    dot.setCssProps({ 'background-color': segColors[i] })
    item.createEl('span', { text: seg.label, cls: 'pw-legend-name' })
    item.createEl('span', { text: formatAmount(seg.value, dp), cls: 'pw-legend-amt' })
    const pct = Math.round((seg.value / total) * 100)
    item.createEl('span', { text: `${pct}%`, cls: 'pw-legend-pct' })
  })

  return chart
}
