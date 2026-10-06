import { App, Component, Events, Keymap, Platform } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { TransactionModal } from '../modal/TransactionModal'
import { MobileTransactionModal } from '../modal/MobileTransactionModal'
import { Transaction } from '../types'
import { parseNoteSegments } from './detailRow'

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
