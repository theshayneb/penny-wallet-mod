import { AbstractInputSuggest, App, TFile, prepareFuzzySearch } from 'obsidian'
import { findWikilinkQuery, insertWikilink } from './wikilinkText'

const MAX_SUGGESTIONS = 20

/**
 * Suggests vault notes while typing a [[wikilink]] in a text input, like
 * Obsidian's editor link suggester. Picking one replaces the partial link
 * with [[note]] and reports the new value through `onChange`.
 */
export class WikilinkSuggest extends AbstractInputSuggest<TFile> {
  private noteInputEl: HTMLInputElement
  private getSourcePath: () => string
  private onChange: (value: string) => void
  private suggestOpen = false

  constructor(app: App, inputEl: HTMLInputElement, getSourcePath: () => string, onChange: (value: string) => void) {
    super(app, inputEl)
    this.noteInputEl = inputEl
    this.getSourcePath = getSourcePath
    this.onChange = onChange
    this.limit = MAX_SUGGESTIONS
  }

  /** True while the suggestion list is showing (so Enter/Escape belong to it). */
  get isOpen(): boolean {
    return this.suggestOpen
  }

  open(): void {
    super.open()
    this.suggestOpen = true
  }

  close(): void {
    super.close()
    this.suggestOpen = false
  }

  protected getSuggestions(): TFile[] {
    const input = this.noteInputEl
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
    const input = this.noteInputEl
    const caret = input.selectionStart ?? input.value.length
    const ctx = findWikilinkQuery(input.value, caret)
    if (ctx) {
      const linktext = this.app.metadataCache.fileToLinktext(file, this.getSourcePath(), true)
      const next = insertWikilink(input.value, caret, ctx.start, linktext)
      input.value = next.value
      input.setSelectionRange(next.caret, next.caret)
      this.onChange(next.value)
    }
    this.close()
    input.focus()
  }
}
