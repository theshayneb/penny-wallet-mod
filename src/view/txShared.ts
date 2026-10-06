import { App, Component, Events, Keymap, Platform } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { TransactionModal } from '../modal/TransactionModal'
import { MobileTransactionModal } from '../modal/MobileTransactionModal'
import { Transaction } from '../types'
import { t, translateCategory } from '../i18n'
import { buildAmountDisplay, buildLine3Display, parseNoteSegments } from './detailRow'

/** Open the add/edit transaction form for an existing transaction. */
export function openTransactionEditor(app: App, walletFile: WalletFile, tx: Transaction, yearMonth: string): void {
  const ModalClass = Platform.isMobile ? MobileTransactionModal : TransactionModal
  new ModalClass(
    app,
    walletFile,
    {},
    tx,
    yearMonth,
    () => (app.workspace as Events).trigger('penny-wallet-mod:refresh'),
    null,
  ).open()
}

/**
 * Render a note's text with [[wikilinks]] as clickable internal links (with
 * hover preview). Link clicks don't bubble, so a clickable row around the
 * note doesn't also open the editor.
 */
export function renderNoteWithLinks(
  el: HTMLElement,
  note: string,
  opts: { app: App; sourcePath: string; hoverParent: Component; source: string },
): void {
  const { app, sourcePath } = opts
  for (const seg of parseNoteSegments(note)) {
    if (seg.kind === 'text') {
      el.appendText(seg.text)
      continue
    }
    const resolved = app.metadataCache.getFirstLinkpathDest(seg.target.split('#')[0] ?? '', sourcePath)
    const link = el.createEl('a', {
      text: seg.text,
      cls: resolved ? 'internal-link' : 'internal-link is-unresolved',
      href: seg.target,
    })
    link.dataset['href'] = seg.target
    link.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      void app.workspace.openLinkText(seg.target, sourcePath, Keymap.isModEvent(e))
    })
    link.addEventListener('mouseover', (e) => {
      app.workspace.trigger('hover-link', {
        event: e,
        source: opts.source,
        hoverParent: opts.hoverParent,
        targetEl: link,
        linktext: seg.target,
        sourcePath,
      })
    })
  }
}

/**
 * One transaction row as shown in the Transactions tab: date, type badge,
 * category (+ budget) / note / tags stack, and amount. Clicking it calls
 * `onClick` (normally opens the editor).
 */
export function renderTransactionRow(
  container: HTMLElement,
  tx: Transaction,
  opts: {
    dp: 0 | 2
    renderNote: (el: HTMLElement, note: string) => void
    onClick: () => void
    dateText?: string  // defaults to the stored MM/DD
  },
): HTMLElement {
  const row = container.createDiv('pw-tx-row')
  row.dataset['testid'] = 'tx-row'

  // col1: date (V-center, large)
  row.createEl('span', { text: opts.dateText ?? tx.date, cls: 'pw-tx-date' })

  // col2: type badge (V-center)
  row.createEl('span', {
    text: t(`label.type.${tx.type}`),
    cls: `pw-type-badge pw-type-${tx.type}`,
  })

  // col3: stack — category (+ budget) / note / tags (note and tags each on their own line)
  const stack = row.createDiv('pw-tx-row-stack')
  const categoryLine = stack.createEl('div', {
    text: translateCategory(tx.category ?? ''),
    cls: 'pw-tx-category',
  })
  if (tx.budget) {
    categoryLine.createSpan({ text: tx.budget, cls: 'pw-tx-budget-chip' }).dataset['testid'] = 'tx-budget-chip'
  }

  const display = buildLine3Display(tx)
  if (display.note !== '') {
    const noteLine = stack.createDiv('pw-tx-row-line3')
    const noteEl = noteLine.createEl('span', { cls: 'pw-tx-note' })
    opts.renderNote(noteEl, display.note)
  }
  if (display.tags.length > 0) {
    const tagsLine = stack.createDiv('pw-tx-row-line4')
    const tagsEl = tagsLine.createSpan('pw-tx-tags')
    for (const tag of display.tags) {
      const chip = tagsEl.createSpan({ text: `#${tag}`, cls: 'pw-tx-tag-chip' })
      chip.dataset['testid'] = 'tx-tag-chip'
      chip.dataset['tag'] = tag
    }
  }
  if (display.note === '' && display.tags.length === 0) {
    const emptyLine = stack.createDiv('pw-tx-row-line3')
    emptyLine.createEl('span', { text: '—', cls: 'pw-tx-empty' })
  }

  // col4: amount (V-center, large)
  const amount = buildAmountDisplay(tx, opts.dp)
  row.createEl('span', { text: amount.text, cls: amount.className })

  row.addEventListener('click', opts.onClick)
  return row
}
