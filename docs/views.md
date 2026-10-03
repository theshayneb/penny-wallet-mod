# Views

PennyWallet has four views. The **Finance Overview** can be opened from the ribbon icon; the others are accessible from the header tabs inside Finance Overview, or via the Command Palette.

---

## Finance Overview

The main dashboard. Open it by clicking the **PennyWallet icon** in the left ribbon, or run **PennyWallet: Open Finance Overview** from the Command Palette.

![Finance overview](/finance-overview.png)

The header also contains two navigation buttons:
- **Transactions** — switch to the Transactions list view
- **Assets** — switch to the assets view
- **+ Add Transaction** — open the transaction form

### Month Navigation

Use `‹` / `›` to move between months. Future months are disabled.

### Layout

The Overview has no summary chips at the top. With budgets set up, the **Budgets** card is on the left, the expense pie charts on the right, and the **Monthly income & expense** bar chart runs full width below. Without budgets, the bar chart takes the left column instead.

### Account Balances

Shows the **current running balance** of every active account, calculated from all transactions since the initial balance was set — not just the current month.

Credit card balances are shown as negative values (outstanding debt).

**Net Assets** at the bottom is the sum of all cash/bank balances minus all credit card debt.

### Asset Allocation Pie

Appears when you have two or more active cash/bank accounts with positive balances. Shows how your liquid assets are distributed across accounts. Each legend entry shows the account name, balance amount, and percentage.

### Expense Pie Charts

Two pie charts break down this month's spending:
- **Expenses by category**
- **Expenses by tag**: one slice per tag (shown as `#tag`), plus **Untagged** for expenses without tags. A transaction with several tags counts in full toward each of them, so the tag slices can add up to more than total spending. Clicking a tag opens the Transactions view filtered to that tag.

Each legend entry shows the name, amount, and percentage. Small categories are grouped into **Others**; select that slice to drill into the grouped items. Hover over a slice or legend item to highlight it.

---

## Transactions

A full list of all transactions for the selected month, with filters and subtotals.

![Transactions view](/transactions-view.png)

### Filters

- **Type pills** — multi-select: All / Expense / Income / Transfer (tap multiple to combine)
- **Wallet pills** — multi-select; pills are tinted per account so the active filter is visible at a glance
- **Category dropdown** — checklist of categories present in the filtered results; select any combination to narrow further
- **Keyword search** — filters transactions whose note contains the search text
- **Filter sheet (detail view)** — a shared header opens a sheet for picking account and date range; on mobile, the sheet backdrop covers the Obsidian toolbar so the sheet owns the screen

### Transaction Rows

Each row shows: date, type badge, category (with the budget name, if assigned), note, tags, and amount.

On desktop, hover a row to reveal the **✏** edit action. On mobile, the edit affordance stays visible. Delete now lives inside the edit modal (a confirmation dialog appears before deletion). Refund expenses appear as positive expense reversals, visually distinct from income.

### Subtotals

A fixed bar at the bottom always shows **Expense Subtotal** and **Income Subtotal** for the currently filtered transactions. The list scrolls independently without affecting the header or subtotals.

---

## Assets

An assets-focused view for medium-term financial tracking. Open it from the **Assets** button in the Finance Overview header, or run **PennyWallet: Open assets** from the Command Palette.

![Assets view](/asset-view.png)

### Range Selector

Choose **3 months**, **6 months**, or **12 months**.

### Account Balances

Shows the current running balance for each active account. Credit card balances are shown as negative values.

**Net Assets** at the bottom is the sum of all cash/bank balances minus all credit card debt.

### Cashflow Metrics

| Metric | Description |
|--------|-------------|
| Income | Total income within the selected range |
| Expense | Total expense within the selected range |
| Balance | Income minus Expense within the selected range |
| Savings Rate | `Balance / Income` (shown as 0% when income is 0) |

### Net Asset Trend Chart

A line chart showing your net asset over the selected range. Hover near a data point to see the value. Missing months (no data) create a gap in the line.

### Asset Allocation Pie

Appears when you have two or more active cash/bank accounts with positive balances. Shows the distribution of liquid assets across those accounts.

---

## Budgets

Shows where you are with each monthly budget. Open it from the **Budgets** tab in the header, or run **PennyWallet: Open budgets** from the Command Palette. Use the month arrows to look at previous months.

- **Totals:** how much is budgeted across all budgets, how much has been spent, and how much is left (or over).
- **One card per budget:** spent vs. amount, a progress bar, and how much is left or over. For the current month, a marker on the bar shows how far through the month you are; the bar turns orange when spending is ahead of that pace and red when over budget. The card also shows the percentage used, a suggested daily amount for the rest of the month, and the most recent transactions. **View all** opens the Transactions view filtered to that budget.
- **Unbudgeted expenses:** expenses this month that have no budget (or a budget that was deleted).

Budgets are set up in **Settings → Budgets**; see [Settings](./settings.md#budgets).
