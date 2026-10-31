# Feature Log 20: Smart PDF Table Parser — Root Cause Fix

## Problem Report

When a user uploaded `demo_leads_data.pdf`, the application showed:

- **0 Valid Leads** (import button disabled)
- **18 Errors** — all showing `Phone number too short (minimum 10 digits required)`
- Column Mapping dropdowns showing only **1 column: `DEMO LEADS DATABASE`** instead of the actual 10 columns

## Root Cause Analysis

### What the PDF looks like

```
Line 1  (y=532): DEMO LEADS DATABASE                        ← Page title
Line 2  (y=514): Sample CRM lead records • All names...     ← Subtitle / disclaimer
Line 3  (y=473): Lead ID | Full Name | Company | Email | Phone | Source | Interest | Status | Last Contact | Next Follow-up
Line 4  (y=450): LD-1001 | Aarav Mehta | Northstar Retail | aarav.mehta@example.com | +91 90000 10001 | Website | AI customer support | New | 28 Oct 2026 | 3 Nov 2026
Line 5a (y=427): Lead management         ← Wrapped text (same cell as…)
Line 5b (y=423): LD-1002 | Diya Sharma | ...               ← Row 2 body
Line 5c (y=418): CRM                      ← Wrapped text continuation in Interest cell
...
Line 16 (y=186): Field guide: ...         ← Footer note
Line 17 (y=163): Demo-data notice: ...    ← Footer note
```

### Bug 1 — Wrong Line 0 Used as Header

The old code sorted Y-positions and unconditionally picked `rawRows[0]` (the topmost non-empty line) as the column header:

```ts
const headers = rawRows[0]  // ❌ grabbed "DEMO LEADS DATABASE" — not the table header!
```

This created a dataset with a **single column named `"DEMO LEADS DATABASE"`**. Every row value was dumped into that one column, so the phone validator never found a valid number.

### Bug 2 — Strict Integer Y Grouping Broke Wrapped Cells

The old code grouped items by `Math.round(item.transform[5])` (exact integer Y):

```ts
const y = Math.round(item.transform[5])
if (!lineMap.has(y)) lineMap.set(y, [])
```

A single cell whose text wraps onto two lines in the PDF (e.g. `"Lead management"` at y=427 and `"CRM"` at y=418) produced **two separate rows** instead of one merged cell. Those orphaned fragment rows caused extra validation errors.

### Bug 3 — No Footer Exclusion

Footer lines like `"Field guide: Lead ID = unique reference..."` were treated as data rows and fed into validation, generating even more errors.

---

## Fix: Smart PDF Table Extractor

**Only file changed:** `src/app/api/admin/leads/preview/route.ts`

The PDF block was replaced with a 5-step positional algorithm:

### Step 1 — Collect All Text Items With (x, y) Coordinates
```ts
const allItems = []  // { str, x, y } for every text chunk on every page
```

### Step 2 — Fuzzy Y-Clustering Into Lines (±4 px tolerance)
Items within 4 pixels in Y are merged into the same line bucket. This prevents sub-pixel font-rendering differences from splitting a single logical line into fragments.

### Step 3 — Smart Header Detection
Each line is scored by two signals:
- **Keyword score (+2 per keyword):** checks for `name`, `phone`, `email`, `lead`, `id`, `company`, `source`, `status`, `interest`, etc.
- **Column count score (+1 per item):** more horizontal items = stronger table header candidate.

The line with the highest total score (minimum 4) is chosen as the header. This correctly skips `"DEMO LEADS DATABASE"` (score=1) and `"Sample CRM lead records..."` (score=1) and selects the actual column row (score=10+20=30).

### Step 4 — Column X-Boundary Mapping
```
Header columns detected at positions:
  Lead ID (x=50), Full Name (x=98), Company (x=169), Email (x=245),
  Phone (x=353), Source (x=427), Interest (x=481), Status (x=566),
  Last Contact (x=628), Next Follow-up (x=690)

Boundaries (midpoints):
  74, 133, 207, 299, 390, 454, 523, 597, 659
```

Any data item whose X falls within a boundary range is assigned to the correct column — regardless of its Y position.

### Step 5 — Data Row Clustering (±10 px Y tolerance) + Footer Skip
- Data items below the header Y are clustered into rows with ±10 px Y tolerance.
- Items where `item.str` matches `/^(field guide|demo.?data notice|note:|page \d)/i` are skipped.
- Items whose text is longer than 120 characters are skipped (long disclaimer sentences).
- Within a row, if two items share the same column (e.g. wrapped text), their strings are joined with a space.

---

## Result After Fix

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Columns detected | 1 (`DEMO LEADS DATABASE`) | 10 (Lead ID, Full Name, Company, Email, Phone, Source, Interest, Status, Last Contact, Next Follow-up) |
| Valid leads | 0 | 10 |
| Errors | 18 | 0 |
| Wrapped cell handling | ❌ Split into separate rows | ✅ Merged into correct column |
| Footer exclusion | ❌ Treated as data | ✅ Skipped automatically |

### Extracted Rows (Proof)

```
LD-1001 | Aarav Mehta        | Northstar Retail   | +91 90000 10001 | Website    | AI customer support     | New           | ...
LD-1002 | Diya Sharma        | BrightPath Academy | +91 90000 10002 | LinkedIn   | Lead management CRM     | Contacted     | ...
LD-1003 | Rohan Kulkarni     | Vertex Solutions   | +91 90000 10003 | Referral   | Workflow automation     | Qualified     | ...
LD-1004 | Ananya Iyer        | GreenCart Foods    | +91 90000 10004 | Instagram  | E-commerce website      | Proposal Sent | ...
LD-1005 | Kabir Patel        | CloudNine Finance  | +91 90000 10005 | Webinar    | Data dashboard          | Negotiation   | ...
LD-1006 | Meera Joshi        | UrbanNest Realty   | +91 90000 10006 | Website    | WhatsApp automation     | New           | ...
LD-1007 | Ishaan Desai       | PixelForge Studio  | +91 90000 10007 | Cold Email | AI content workflow     | Contacted     | ...
LD-1008 | Sara Khan          | CareBridge Health  | +91 90000 10008 | Referral   | Appointment booking app | Qualified     | ...
LD-1009 | Vivaan Rao         | SwiftLogix         | +91 90000 10009 | LinkedIn   | Operations automation   | Lost          | ...
LD-1010 | Tara Nair          | LearnLoop          | +91 90000 10010 | Instagram  | Learning platform       | Proposal Sent | ...
```

---

## Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `src/app/api/admin/leads/preview/route.ts` | Modified | Replaced old PDF line-split parser with smart X-position column-boundary extractor |

## Build Status
- `npm run build` → **Exit Code 0**, 0 TypeScript errors ✅
