# Transactions

PennyWallet has three transaction types. Each is designed for a specific real-world scenario.

> The Add Transaction form only adds **expenses**: it has no type selector and no refund checkbox. Income and transfers created earlier (or through a `penny-wallet-mod` link with `type=`) can still be edited; the form title shows their type. Editing an existing refund keeps it a refund.

---

## Transaction Types

> **Linking notes:** in the Note field, type `[[` followed by part of a note's name (e.g. `[[mom`) and a list of matching notes from your vault appears. Pick one with a tap/click, or with the arrow keys and Enter, to insert `[[Note name]]`. Links show as clickable links in the Transactions list.

> The Add Transaction form has no account field for expenses and income: they are recorded against the **Default Account** set in Settings (income skips credit cards and uses the first cash/bank account instead). Transfers still have From / To accounts. A transaction created from a `penny-wallet-mod` link with `wallet=` keeps that account, and editing a transaction keeps its existing account.

### Expense

Money leaving one of your accounts for a purchase or payment.

| Field | Required | Notes |
|-------|----------|-------|
| Budget | No | Shown when budgets exist; see [Budgets](./settings.md#budgets) |
| Category | No | e.g. Food, Transport, Shopping |
| Note | No | Free-text description; type `[[` to link a note from your vault |
| Amount | Yes | Positive number |

**Effect on balance:**
- Cash / Bank account → balance decreases
- Credit Card → outstanding debt increases
- Refund (negative amount, from older entries or edited in the Markdown file) → credit card debt or cash/bank spending is reduced

**Example:** Paid NT$280 for lunch with cash
→ Category: `Food`, Amount: `280` (default account: `Cash`)

---

### Income

Money arriving into one of your cash or bank accounts.

| Field | Required | Notes |
|-------|----------|-------|
| Category | No | e.g. Salary, Bonus, Side Income |
| Note | No | Free-text description; type `[[` to link a note from your vault |
| Amount | Yes | Positive number |

**Effect on balance:**
- Any account type → balance increases

**Example:** Monthly salary deposited into HSBC
→ Category: `Salary`, Amount: `72000` (default account: `HSBC Savings`)

---

### Transfer

Moving money between two of your own accounts — including credit card payments and investment trades.

| Field | Required | Notes |
|-------|----------|-------|
| Category | Yes | e.g. Account Transfer, Credit Card Payment |
| From Account | Yes | Source account |
| To Account | Yes | Destination account |
| Note | No | Free-text description; type `[[` to link a note from your vault |
| Amount | Yes | Positive number |

**Transfer categories and their account rules:**

| Category | From Account | To Account |
|----------|-------------|------------|
| Account Transfer | Any non-credit-card | Any non-credit-card |
| Credit Card Payment | Cash or Bank | Credit Card |
| Investment Trade | Any | Any |

**Effect on balance:**
- Account Transfer / Investment Trade: From decreases, To increases
- Credit Card Payment: From (bank) decreases, To (credit card) debt decreases

**Example:** Withdraw NT$8,000 cash from ATM
→ Category: `Account Transfer`, From: `HSBC Savings`, To: `Cash`, Amount: `8000`

**Example:** Pay NT$5,200 credit card bill from savings
→ Category: `Credit Card Payment`, From: `HSBC Savings`, To: `Visa Platinum`, Amount: `5200`

> See [Credit Card Workflow](./credit-card-workflow) for the full credit card cycle.

---

## Adding a Transaction

**From Finance Overview or Transactions view:** click **+ Add Transaction**

**From the Command Palette:** run `PennyWallet: Add Transaction`

**From the ribbon icon:** click the balloon icon → then **+ Add Transaction**

**From iOS Shortcuts:** see [URI Handler & iOS Shortcuts](./uri-handler)

### Mobile entry

On phones (`body.is-phone`), the transaction form switches to a touch-friendly layout:

- **Amount** opens a calculator sheet — numpad, `00`, ⌫, and a formula bar in the sheet title. Press **Done** to commit the computed value back into the field.
- **Wallet**, **Category**, and **Tag** fields open as bottom-sheet pickers with search; tags and categories can be created inline from the picker.

<img src="/transaction-modal-mobile.png" alt="Mobile calculator sheet" width="320" />

---

## Editing and Deleting

Open the **Transactions** view, find the entry, and click the **edit (✏)** icon on the right side of the row. **Delete** lives inside the edit modal — open the entry to edit, then use the delete action (a confirmation dialog appears before deletion).

Editing supports changing the **date** (including moving the transaction to a different month), the type, category, budget, note, and amount (and the From / To accounts of transfers).

---

## Default Categories

### Expense
`Food` · `Clothing` · `Home` · `Transport` · `Education` · `Entertainment` · `Shopping` · `Medical` · `Cash Expense` · `Insurance` · `Fees` · `Tax`

### Income
`Salary` · `Interest` · `Side Income` · `Bonus` · `Lottery` · `Rent` · `Cashback` · `Dividend` · `Investment Profit` · `Insurance Claim` · `Pension`

### Transfer
`Account Transfer` · `Credit Card Payment` · `Investment Trade`

Refunds are no longer a transfer category; they are stored as an **Expense** with a negative amount.

If a transaction has no category, it is shown as **Uncategorized**. This is a display-only label — nothing is stored.

Custom categories can be added in **Settings → PennyWallet → Custom Categories**.
