import { describe, it, expect } from 'vitest'
import { TFile } from 'obsidian'
import { WikilinkSuggest } from '../../src/modal/WikilinkSuggest'

const file = (path: string, mtime = 0) => Object.assign(new TFile(), {
  path,
  basename: path.split('/').pop()!.replace(/\.md$/, ''),
  stat: { mtime },
  parent: { path: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '/', isRoot: () => !path.includes('/') },
})

function setup(value: string, files = [file('People/Mom.md', 2), file('Momentum.md', 3), file('Dad.md', 1)]) {
  const input = { value, selectionStart: value.length, setSelectionRange() {}, focus() {} } as unknown as HTMLInputElement
  const app = {
    vault: { getMarkdownFiles: () => files },
    metadataCache: { fileToLinktext: (f: TFile) => f.basename },
  }
  let picked = ''
  const suggest = new WikilinkSuggest(app as never, input, () => 'PennyWallet/2026-10.md', (v) => { picked = v })
  return { suggest, input, picked: () => picked }
}

// getSuggestions is protected; reach it the way the base class does.
const suggestions = (s: WikilinkSuggest) => (s as unknown as { getSuggestions(q: string): TFile[] }).getSuggestions('')

describe('WikilinkSuggest', () => {
  it('constructs on top of the suggest base class without clashing with its internals', () => {
    expect(() => setup('')).not.toThrow()
  })

  it('tracks whether the suggestion list is showing', () => {
    const { suggest } = setup('')
    expect(suggest.isShowingSuggestions()).toBe(false)
    suggest.open()
    expect(suggest.isShowingSuggestions()).toBe(true)
    suggest.close()
    expect(suggest.isShowingSuggestions()).toBe(false)
  })

  it('no suggestions outside a [[link', () => {
    expect(suggestions(setup('lunch with mom').suggest)).toEqual([])
  })

  it('suggests matching notes, best name match first', () => {
    const names = suggestions(setup('lunch with [[mom').suggest).map(f => f.basename)
    expect(names).toEqual(['Mom', 'Momentum'])
  })

  it('suggests recently edited notes right after [[', () => {
    const names = suggestions(setup('[[').suggest).map(f => f.basename)
    expect(names).toEqual(['Momentum', 'Mom', 'Dad'])
  })

  it('picking a note completes the link and reports the new value', () => {
    const { suggest, input, picked } = setup('lunch with [[mo')
    suggest.selectSuggestion(file('People/Mom.md'))
    expect(input.value).toBe('lunch with [[Mom]]')
    expect(picked()).toBe('lunch with [[Mom]]')
  })
})
