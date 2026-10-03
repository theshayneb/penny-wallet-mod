import { describe, it, expect } from 'vitest'
import { WalletFile } from '../../src/io/WalletFile'
import { DEFAULT_CONFIG } from '../../src/types'
import { createMockApp } from '../helpers/mockApp'

// ── loadConfig ────────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  it('creates a default config on first launch (no file)', async () => {
    const { app, store } = createMockApp() // empty vault
    const wf = new WalletFile(app)
    const config = await wf.loadConfig()

    expect(config.wallets).toHaveLength(1)
    // setup.ts stubs window.moment.locale() → 'en', so default wallet name is 'Cash'
    expect(config.wallets[0].name).toBeTruthy()
    expect(store.has('.penny-wallet.json')).toBe(true)
  })

  it('loads config from existing .penny-wallet.json', async () => {
    const saved = { ...DEFAULT_CONFIG, defaultWallet: 'MyBank', wallets: [
      { name: 'MyBank', type: 'bank' as const, initialBalance: 9999, status: 'active' as const, includeInNetAsset: true },
    ]}
    const { app } = createMockApp({ '.penny-wallet.json': JSON.stringify(saved) })
    const wf = new WalletFile(app)
    const config = await wf.loadConfig()

    expect(config.defaultWallet).toBe('MyBank')
    expect(config.wallets[0].initialBalance).toBe(9999)
  })

  it('loads dotfile config through adapter when vault index omits it', async () => {
    const saved = { ...DEFAULT_CONFIG, defaultWallet: 'HiddenBank', wallets: [
      { name: 'HiddenBank', type: 'bank' as const, initialBalance: 1234, status: 'active' as const, includeInNetAsset: true },
    ]}
    const { app } = createMockApp(
      { '.penny-wallet.json': JSON.stringify(saved) },
      { hiddenPaths: ['.penny-wallet.json'] },
    )
    const wf = new WalletFile(app)
    const config = await wf.loadConfig()

    expect(config.defaultWallet).toBe('HiddenBank')
    expect(config.wallets[0].initialBalance).toBe(1234)
  })

  it('falls back to DEFAULT_CONFIG for malformed JSON', async () => {
    const { app } = createMockApp({ '.penny-wallet.json': '{ invalid json }' })
    const wf = new WalletFile(app)
    const config = await wf.loadConfig()

    expect(config.wallets).toEqual(DEFAULT_CONFIG.wallets)
    expect(config.folderName).toBe(DEFAULT_CONFIG.folderName)
  })
})

// ── saveConfig / updateConfig ─────────────────────────────────────────────────

describe('saveConfig + updateConfig', () => {
  it('persists a patched config to the vault', async () => {
    const { app, store } = createMockApp({ '.penny-wallet.json': JSON.stringify(DEFAULT_CONFIG) })
    const wf = new WalletFile(app)
    await wf.loadConfig()

    wf.updateConfig({ defaultWallet: 'Updated' })
    await wf.saveConfig()

    const raw = store.get('.penny-wallet.json')!
    const parsed = JSON.parse(raw)
    expect(parsed.defaultWallet).toBe('Updated')
  })

  it('getConfig returns the in-memory config after updateConfig', async () => {
    const { app } = createMockApp({ '.penny-wallet.json': JSON.stringify(DEFAULT_CONFIG) })
    const wf = new WalletFile(app)
    await wf.loadConfig()

    wf.updateConfig({ folderName: 'MyLedgers' })
    expect(wf.getConfig().folderName).toBe('MyLedgers')
  })
})

// ── addTag ────────────────────────────────────────────────────────────────────

describe('addTag', () => {
  async function setup() {
    const { app, store } = createMockApp({ '.penny-wallet.json': JSON.stringify(DEFAULT_CONFIG) })
    const wf = new WalletFile(app)
    await wf.loadConfig()
    return { wf, store, app }
  }

  it('adds new tag to config.tags', async () => {
    const { wf } = await setup()
    const result = await wf.addTag('coffee')
    expect(result).toEqual({ ok: true })
    expect(wf.getConfig().tags).toContain('coffee')
  })

  it('keeps config.tags alphabetically sorted', async () => {
    const { wf } = await setup()
    await wf.addTag('zebra')
    await wf.addTag('apple')
    await wf.addTag('mango')
    const tags = wf.getConfig().tags
    expect(tags).toEqual([...tags].sort())
    expect(tags.indexOf('apple')).toBeLessThan(tags.indexOf('mango'))
    expect(tags.indexOf('mango')).toBeLessThan(tags.indexOf('zebra'))
  })

  it('trims whitespace', async () => {
    const { wf } = await setup()
    await wf.addTag('  coffee  ')
    expect(wf.getConfig().tags).toContain('coffee')
    expect(wf.getConfig().tags).not.toContain('  coffee  ')
  })

  it('strips leading #', async () => {
    const { wf } = await setup()
    await wf.addTag('#coffee')
    expect(wf.getConfig().tags).toContain('coffee')
    expect(wf.getConfig().tags).not.toContain('#coffee')
  })

  it('rejects empty string', async () => {
    const { wf } = await setup()
    expect(await wf.addTag('')).toEqual({ ok: false, reason: 'empty' })
    expect(await wf.addTag('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(await wf.addTag('#')).toEqual({ ok: false, reason: 'empty' })
    expect(wf.getConfig().tags).toEqual([])
  })

  it('rejects duplicate (case-sensitive)', async () => {
    const { wf } = await setup()
    await wf.addTag('coffee')
    expect(await wf.addTag('coffee')).toEqual({ ok: false, reason: 'duplicate' })
    expect(await wf.addTag('#coffee')).toEqual({ ok: false, reason: 'duplicate' })
    expect(wf.getConfig().tags.filter(t => t === 'coffee').length).toBe(1)
  })

  it('persists to disk', async () => {
    const { wf, store } = await setup()
    await wf.addTag('coffee')
    const raw = store.get('.penny-wallet.json')!
    expect(JSON.parse(raw).tags).toContain('coffee')
  })
})

// ── Plugin data store (data.json, synced by Obsidian Sync) ───────────────────

describe('loadConfig with a config store', () => {
  const makeStore = (initial: unknown = null) => {
    let data = initial
    const saves: unknown[] = []
    return {
      store: {
        load: async () => data,
        save: async (config: unknown) => { data = JSON.parse(JSON.stringify(config)); saves.push(data) },
      },
      get data() { return data },
      saves,
    }
  }
  const bankConfig = (name: string) => ({ ...DEFAULT_CONFIG, defaultWallet: name, wallets: [
    { name, type: 'bank' as const, initialBalance: 1, status: 'active' as const, includeInNetAsset: true },
  ], budgets: [{ name: 'Groceries', amount: 500 }] })

  it('loads from plugin data and ignores the legacy file', async () => {
    const s = makeStore(bankConfig('Synced'))
    const { app } = createMockApp({ '.penny-wallet.json': JSON.stringify(bankConfig('Legacy')) })
    const config = await new WalletFile(app, s.store).loadConfig()
    expect(config.defaultWallet).toBe('Synced')
    expect(config.budgets).toEqual([{ name: 'Groceries', amount: 500 }])
    expect(s.saves).toHaveLength(0)
  })

  it('migrates the legacy .penny-wallet.json into plugin data once, leaving the file in place', async () => {
    const s = makeStore(null)
    const { app, store } = createMockApp({ '.penny-wallet.json': JSON.stringify(bankConfig('Legacy')) })
    const config = await new WalletFile(app, s.store).loadConfig()
    expect(config.defaultWallet).toBe('Legacy')
    expect((s.data as { defaultWallet: string }).defaultWallet).toBe('Legacy')
    expect(store.has('.penny-wallet.json')).toBe(true)
  })

  it('first launch writes defaults to plugin data, not the vault root', async () => {
    const s = makeStore(null)
    const { app, store } = createMockApp()
    const wf = new WalletFile(app, s.store)
    await wf.loadConfig()
    expect(wf.didCreateDefaultConfigOnLastLoad()).toBe(true)
    expect(s.saves).toHaveLength(1)
    expect(store.has('.penny-wallet.json')).toBe(false)
  })

  it('saveConfig writes to plugin data', async () => {
    const s = makeStore(bankConfig('A'))
    const { app, store } = createMockApp()
    const wf = new WalletFile(app, s.store)
    await wf.loadConfig()
    wf.updateConfig({ decimalPlaces: 2 })
    await wf.saveConfig()
    expect((s.data as { decimalPlaces: number }).decimalPlaces).toBe(2)
    expect(store.has('.penny-wallet.json')).toBe(false)
  })

  it('malformed legacy file → defaults, nothing written', async () => {
    const s = makeStore(null)
    const { app } = createMockApp({ '.penny-wallet.json': '{ nope' })
    const config = await new WalletFile(app, s.store).loadConfig()
    expect(config.wallets).toEqual(DEFAULT_CONFIG.wallets)
    expect(s.saves).toHaveLength(0)
  })

  it('reloading picks up settings changed by sync', async () => {
    const s = makeStore(bankConfig('Before'))
    const { app } = createMockApp()
    const wf = new WalletFile(app, s.store)
    await wf.loadConfig()
    await s.store.save(bankConfig('After'))  // e.g. data.json replaced by Obsidian Sync
    await wf.loadConfig()
    expect(wf.getConfig().defaultWallet).toBe('After')
  })
})

describe('hidden built-in categories', () => {
  it('persist through save and reload, dropping unknown keys', async () => {
    let data: unknown = null
    const s = { load: async () => data, save: async (c: unknown) => { data = JSON.parse(JSON.stringify(c)) } }
    const { app } = createMockApp()
    const wf = new WalletFile(app, s)
    await wf.loadConfig()
    wf.updateHiddenCategories('expense', ['tax', 'not_a_builtin'])
    await wf.saveConfig()

    const reloaded = new WalletFile(app, s)
    const config = await reloaded.loadConfig()
    expect(config.options.categories.expense.hidden).toEqual(['tax'])
    expect(config.options.categories.expense.default).toContain('tax')
    expect(config.options.categories.income.hidden).toEqual([])
  })
})
