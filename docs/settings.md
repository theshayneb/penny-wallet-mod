# Settings

Open via **Settings → PennyWallet** in Obsidian.

## Syncing settings between devices

All settings on this page (accounts, categories, tags, budgets, folder name, default account, decimal places) are stored in the plugin's `data.json`. To sync them with **Obsidian Sync**, turn on **Settings → Sync → Vault configuration sync → Installed community plugins** on every device. Changes made on one device are picked up automatically on the others, even while Obsidian is open. Transactions are regular Markdown files in your PennyWallet folder and sync like any other note.

---

## General

### Folder Name

The vault folder where monthly transaction files are stored. Default: `PennyWallet`

The path is relative to the vault root. Change this if you want transactions stored in a subfolder, e.g. `Finance/Ledger`.

> **Note:** Changing this setting does not move existing files. Move them manually and update the setting to match.

### Default Account

The account every expense and income added from the Add Transaction form is recorded against (the form has no account field). Income can't go to a credit card, so if the default is a credit card, income uses the first active cash/bank account. Choose any active account from the dropdown.

### Decimal Places

Controls how amounts are stored and displayed.

| Option | Use case |
|--------|----------|
| Integer (0 decimals) | Most currencies, NT dollars |
| 2 decimal places | USD, EUR, or when cents matter |

> Changing this setting affects new transactions. Existing transactions stored as integers will display without decimals regardless.

---

## Active Accounts

Lists all accounts with status `active`.

Each row shows:
- **Account name** and type
- **Initial balance** and **current calculated balance**
- **Edit** button — change name or initial balance
- **Archive** button (if the account has transactions) or **Delete** button (if no transactions exist)

### Edit an Account

You can change:
- **Name** — updates all display labels (does not rename transaction records in `.md` files)
- **Initial Balance** — retroactively recalculates all balances from inception

> Renaming an account does **not** update the account name stored inside historical transaction files. Old transactions will reference the old name, which may cause balance discrepancies. Avoid renaming accounts that already have transactions.

---

## Archived Accounts

Lists archived accounts. Each row has:

**Include in Net Assets** toggle — whether this account's balance counts toward net asset calculation. Useful for closed accounts you want to keep in history but exclude from your current net asset total.

**Unarchive** button — restores the account to Active Accounts status. It will reappear in the Add Transaction form and be fully usable again.

---

## Add Account

Fields:
- **Name** — unique, cannot be empty
- **Type** — Cash / Bank / Credit Card
- **Initial Balance** — current balance (credit card: current outstanding debt)

Click **Add Account** or press **Enter** in any field to confirm.

---

## Budgets

Create budgets with a monthly amount (e.g. *Groceries — 500*). When adding or editing an **expense**, pick a budget in the **Budget** field. Each month, the expenses assigned to a budget are deducted from its amount; refunds give money back. Budgets reset at the start of every month (no carry-over).

The **Budgets** card on the Overview shows, for the selected month, how much of each budget is spent and how much is left (or how much it is over). Click a budget to see its transactions.

- Edit a budget's name or amount directly in its row. Renaming updates every transaction assigned to it.
- Deleting a budget keeps the budget name on existing transactions; they just stop counting toward any budget.
- Budget names cannot contain `|`.

---

## Categories

Add your own expense, income, and transfer categories, and remove built-in ones you don't use.

Each section lists the built-in categories followed by your custom ones. Click **×** on a built-in category to remove it from the Add Transaction form; it then appears under **Removed**, where clicking it brings it back. Transactions that already use a removed category keep it (and editing them still shows it).

Three sections are available: **Expense**, **Income**, and **Transfer**. Custom categories are shown **after** the default categories in the Add Transaction form.

Click **×** on a tag to remove a custom category. This does not affect existing transactions that already used that category — they will continue to display the category name as a raw string.

> A category name cannot duplicate an existing default or custom category in either list.
