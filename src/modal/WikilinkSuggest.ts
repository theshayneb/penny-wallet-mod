import { AbstractInputSuggest, App, TFile, prepareFuzzySearch } from 'obsidian'
import { findWikilinkQuery, insertWikilink } from './wikilinkText'

const MAX_SUGGESTIONS = 20

/**
 * Suggests vault notes while typing a [[wikilink]] in a text input, like
 * Obsidian's editor link suggester. Picking one replaces the partial link
 * with [[note]] and reports the new value through `onPick`.
 */
export class WikilinkSuggest extends AbstractInputSuggest<TFile> {
  // Fields use a pw prefix: Obsidian's suggest base classes keep undocumented
  // internal state (e.g. `isOpen`), and a same-named member here breaks them.
  private pwInputEl: HTMLInputElement
  private pwSourcePath: () => string
  private pwOnPick: (value: string) => void
  private pwShowing = false

  constructor(app: App, inputEl: HTMLInputElement, getSourcePath: () => string, onPick: (value: string) => void) {
    super(app, inputEl)
    this.pwInputEl = inputEl
    this.pwSourcePath = getSourcePath
    this.pwOnPick = onPick
    this.limit = MAX_SUGGESTIONS
  }

  /** True while the suggestion list is showing (so Enter/Escape belong to it). */
  isShowingSuggestions(): boolean {
    return this.pwShowing
  }

  open(): void {
    super.open()
    this.pwShowing = true
  }

  close(): void {
    super.close()
    this.pwShowing = false
  }

  protected getSuggestions(): TFile[] {
    const input = this.pwInputEl
    const ctx = findWikilinkQuery(input.value, input.selectionStart ?? input.value.length)
    if (!ctx) return []

    const files = this.app.vault.getMarkdownFiles()
    const query = ctx.query.trim()
    if (!query) {
      return [...files].sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, MAX_SUGGESTIONS)
    }
    const match = prepareFuzzySearch(query)
    const scored: { file: TFile; score: number }[] = []
    for (const file of files) {
      // Prefer matches on the note name; fall back to the full path.
      const byName = match(file.basename)
      const result = byName ?? match(file.path)
      if (result) scored.push({ file, score: result.score + (byName ? 1 : 0) })
    }
    scored.sort((a, b) => b.score - a.score || a.file.basename.length - b.file.basename.length)
    return scored.slice(0, MAX_SUGGESTIONS).map(s => s.file)
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.addClass('mod-complex')
    const content = el.createDiv('suggestion-content')
    content.createDiv({ text: file.basename, cls: 'suggestion-title' })
    const folder = file.parent && !file.parent.isRoot() ? file.parent.path : ''
    if (folder) content.createDiv({ text: folder, cls: 'suggestion-note' })
  }

  selectSuggestion(file: TFile): void {
    const input = this.pwInputEl
    const caret = input.selectionStart ?? input.value.length
    const ctx = findWikilinkQuery(input.value, caret)
    if (ctx) {
      const linktext = this.app.metadataCache.fileToLinktext(file, this.pwSourcePath(), true)
      const next = insertWikilink(input.value, caret, ctx.start, linktext)
      input.value = next.value
      input.setSelectionRange(next.caret, next.caret)
      this.pwOnPick(next.value)
    }
    this.close()
    input.focus()
  }
}
