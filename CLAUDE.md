# PennyWallet Mod: notes for Claude Code

A personal fork of the PennyWallet Obsidian plugin. The owner is the only user.

## Workflow

- Push finished, checked work straight to `main`. No pull requests, no asking first.
- Every change that ships gets a new patch version (0.0.x) and a GitHub release:
  1. Bump the version in `manifest.json`, `package.json` and `package-lock.json` (the top-level `version` and `packages[""].version`), and add it to the top of `versions.json` mapped to `manifest.json`'s `minAppVersion`.
  2. Add a `## [x.y.z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md`. The release workflow uses it as the release notes and fails without it.
  3. Commit, push to `main`, then push the tag `x.y.z` (no `v` prefix) pointing at that commit. `.github/workflows/release.yml` builds the plugin and publishes the release with `main.js`, `manifest.json` and `styles.css`.
  4. Tell the owner the version number. Don't give them git commands; they use the GitHub web interface.
- Never reuse a version number that was already tagged or released.

## Checks before pushing

```
npm run lint        # eslint + tsc
npm run lint:i18n   # one known warning: 'tagPicker.tooLong' (CJK)
npm run lint:css
npm test
npm run build
```

## Things to know

- Settings live in the plugin's `data.json` (synced by Obsidian Sync). The old vault-root `.penny-wallet.json` is only read once, for migration.
- UI strings go in `src/i18n.ts` in both `zh-TW` and `en`; the Obsidian lint rules require sentence case.
- Don't give subclasses of Obsidian classes members that may clash with undocumented internals (e.g. `isOpen` on `AbstractInputSuggest`); use a `pw` prefix.
- On the owner's Android phone, settings synced from another device may only appear after fully closing and reopening Obsidian.
