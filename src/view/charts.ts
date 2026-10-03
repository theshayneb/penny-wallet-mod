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
  expense: number
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
      ['--pw-income', '#5DCAA5'], ['--pw-transfer', '#85B7EB'], ['--pw-credit', '#D85A30'], '#888780',
    ].map(entry => Array.isArray(entry) ? v(entry[0], entry[1]) : entry),
  }
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

/** Monthly expense bars (income is not tracked on the Overview). */
export function drawExpenseChart(
  container: HTMLElement,
  data: MonthData[],
  dp: 0 | 2 = 0,
): Chart {
  const colors = getThemeColors()
  const canvas = container.createEl('canvas')

  const cfg: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: data.map(d => d.monthLabel),
      datasets: [
        {
          label: t('dash.expense'),
          data: data.map(d => d.expense),
          backgroundColor: colors.expense,
          borderWidth: 0,
          maxBarThickness: 56,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Room above the tallest bar for its value label
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => data[items[0].dataIndex].tooltipLabel,
            label: (ctx) => `${t('dash.expense')}: ${formatK(ctx.raw as number, dp)}`,
          },
        },
        datalabels: {
          color: colors.label,
          clip: false,
          anchor: 'end',
          align: 'top',
          offset: 2,
          formatter: (v: number) => v !== 0 ? formatK(v, dp) : '',
          font: { size: 10, weight: 'bold' },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: colors.muted },
        },
        y: {
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
  const segColors = segments.map((_, i) => colors.pie[i % colors.pie.length])

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
