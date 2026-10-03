import { describe, it, expect } from 'vitest'
import { findWikilinkQuery, insertWikilink } from '../../src/modal/wikilinkText'

describe('findWikilinkQuery', () => {
  it('finds the partial link before the caret', () => {
    expect(findWikilinkQuery('dinner with [[mo', 16)).toEqual({ start: 12, query: 'mo' })
  })
  it('empty query right after [[', () => {
    expect(findWikilinkQuery('[[', 2)).toEqual({ start: 0, query: '' })
  })
  it('null when there is no [[ before the caret', () => {
    expect(findWikilinkQuery('lunch', 5)).toBeNull()
  })
  it('null when the link is already closed', () => {
    expect(findWikilinkQuery('[[Mom]] and', 11)).toBeNull()
  })
  it('null once an alias has started', () => {
    expect(findWikilinkQuery('[[Mom|M', 7)).toBeNull()
  })
  it('uses the caret, not the end of the text', () => {
    expect(findWikilinkQuery('[[mo and more', 4)).toEqual({ start: 0, query: 'mo' })
  })
  it('second link after a closed one', () => {
    expect(findWikilinkQuery('[[A]] [[b', 9)).toEqual({ start: 6, query: 'b' })
  })
})

describe('insertWikilink', () => {
  it('completes a link at the end of the text', () => {
    expect(insertWikilink('dinner with [[mo', 16, 12, 'Mom')).toEqual({ value: 'dinner with [[Mom]]', caret: 19 })
  })
  it('keeps text after the caret', () => {
    expect(insertWikilink('[[mo and dad', 4, 0, 'Mom')).toEqual({ value: '[[Mom]] and dad', caret: 7 })
  })
  it('consumes an existing closing ]] and the rest of the name', () => {
    expect(insertWikilink('[[mo]] x', 4, 0, 'Mom')).toEqual({ value: '[[Mom]] x', caret: 7 })
    expect(insertWikilink('[[mom]]', 3, 0, 'Mom')).toEqual({ value: '[[Mom]]', caret: 7 })
  })
  it('does not swallow a later, separate link', () => {
    expect(insertWikilink('[[mo x [[B]]', 4, 0, 'Mom')).toEqual({ value: '[[Mom]] x [[B]]', caret: 7 })
  })
  it('folder-qualified link text', () => {
    expect(insertWikilink('[[mo', 4, 0, 'People/Mom').value).toBe('[[People/Mom]]')
  })
})
