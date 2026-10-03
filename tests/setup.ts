import { vi } from 'vitest'

// ── Obsidian API stubs ────────────────────────────────────────────────────────

class TFile {
  path: string = ''
  basename: string = ''
  extension: string = ''
  constructor(path: string = '') {
    this.path = path
    const leaf = path ? path.split('/').pop()! : ''
    this.basename = leaf.replace(/\.[^.]+$/, '')
    this.extension = leaf.includes('.') ? leaf.split('.').pop()! : ''
  }
}

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.replace(/\\/g, '/'),
  TFile,
  App: class App {},
  Modal: class Modal {
    app: unknown
    contentEl = { empty: vi.fn(), createEl: vi.fn(), createDiv: vi.fn(), addClass: vi.fn() }
    constructor(app: unknown) { this.app = app }
    open() {}
    close() {}
  },
  Notice: class Notice { constructor(_: string) {} },
  Plugin: class Plugin {},
  // Mirrors Obsidian's suggest base class closely enough to catch subclasses
  // that clash with its internal state (it assigns isOpen etc. in its constructor).
  AbstractInputSuggest: class AbstractInputSuggest {
    app: unknown
    limit = 100
    isOpen = false
    suggestEl = {}
    textInputEl: unknown
    constructor(app: unknown, textInputEl: unknown) {
      this.app = app
      this.textInputEl = textInputEl
    }
    open() { this.isOpen = true }
    close() { this.isOpen = false }
  },
  prepareFuzzySearch: (query: string) => (text: string) => {
    // Subsequence match, like Obsidian's fuzzy search; higher score for tighter matches.
    const q = query.toLowerCase(), t = text.toLowerCase()
    let i = 0, first = -1
    for (let j = 0; j < t.length && i < q.length; j++) {
      if (t[j] === q[i]) { if (first === -1) first = j; i++ }
    }
    return i === q.length ? { score: -first - (t.length - q.length) * 0.01, matches: [] } : null
  },
}))

// ── window.moment stub (used by getLocaleCashName) ────────────────────────────
Object.defineProperty(global, 'window', {
  value: { moment: { locale: () => 'en' } },
  writable: true,
})
