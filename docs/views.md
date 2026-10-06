# Views

PennyWallet has three views. The **Finance Overview** can be opened from the ribbon icon; the others are accessible from the header tabs inside Finance Overview, or via the Command Palette.

---

## Finance Overview

The main dashboard. Open it by clicking the **PennyWallet icon** in the left ribbon, or run **PennyWallet: Open Finance Overview** from the Command Palette.

![Finance overview](/finance-overview.png)

The header has three tabs (**Overview**, **Transactions**, **Budgets**) and a **+ Add Transaction** button that opens the transaction form.

### Month Navigation

Use `‹` / `›` to move between months. Future months are disabled.

### Layout

The Overview has no summary chips at the top. The left column shows the **Budgets** card (when budgets are set up) and the **Follow-ups** card side by side (stacked when the window is narrow), with the **Monthly expenses** bar chart for the last six months (ending at the selected month) under them; the expense pie charts are on the right.

Switching between the **Overview**, **Transactions** and **Budgets** tabs, or clicking through from a chart or budget, replaces the view in the current Obsidian tab instead of opening a new one.

### Follow-ups

Lists every transaction tagged with the follow-up tag (default `follow_up`, set in **Settings → Follow-up tag**), from all months, newest first. Each row shows the date, note (with clickable `[[links]]`), category and amount; click a row to edit the transaction, for example to remove the tag once it's dealt with. Tag matching ignores case and treats `-` and `_` as the same, so `follow-up` also matches. Clear the setting to hide the card.

### Expense Pie Charts

Two pie charts break down this month's spending:
- **Expenses by category**
- **Expenses by tag**: one slice per tag (shown as `#tag`), plus **Untagged** for expenses without tags. Tags listed in **Settings → Tags hidden from the tag chart** (default: `follow-up`) are left out. A transaction with several tags counts in full toward each of them, so the tag slices can add up to more than total spending. Clicking a tag opens the Transactions view filtered to that tag.

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

## Budgets

Shows where you are with each monthly budget. Open it from the **Budgets** tab in the header, or run **PennyWallet: Open budgets** from the Command Palette. Use the month arrows to look at previous months.

- **Totals:** how much is budgeted across all budgets, how much has been spent, and how much is left (or over).
- **One card per budget:** spent vs. amount, a progress bar, and how much is left or over. For the current month, a marker on the bar shows how far through the month you are; the bar turns orange when spending is ahead of that pace and red when over budget. The card also shows the percentage used, a suggested daily amount for the rest of the month, and the most recent transactions. **View all** opens the Transactions view filtered to that budget.
- **Unbudgeted expenses:** expenses this month that have no budget (or a budget that was deleted).

Budgets are set up in **Settings → Budgets**; see [Settings](./settings.md#budgets).
