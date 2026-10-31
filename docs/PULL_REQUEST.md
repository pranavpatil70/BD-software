# Pull Request: Feature Branch `feature/lead-management-v2`

> **Branch:** `feature/lead-management-v2`  
> **Base:** `main`  
> **Author:** Callopss Dev Team  
> **Date:** 2026-10-31  
> **Build Status:** ✅ Exit Code 0 — 0 TypeScript errors

---

## Summary

This branch implements a major set of improvements across security, lead importing, lead history, and the admin upload experience. It covers **20 completed features** tracked in `docs/WORK_LOG.md`, ranging from foundational infrastructure (database indexing, smart DB client, server pre-fetching) all the way to end-user facing features (timeline drawer, drag-and-drop upload, PDF parser fix).

---

## What Was Built — Feature Index

| # | Feature | Key Files | Status |
|---|---------|-----------|--------|
| 01 | Cloud Region Co-location | `vercel.json` | ✅ |
| 02 | Local Env Flexibility | `src/lib/env.ts` | ✅ |
| 03 | Smart Prisma DB Client | `src/lib/prisma.ts` | ✅ |
| 04 | Database Indexing | `prisma/schema.prisma` | ✅ |
| 05 | Leads Server Pre-fetch | `src/app/admin/leads/page.tsx` | ✅ |
| 06 | Dashboard Server Pre-fetch | `src/app/dashboard/page.tsx` | ✅ |
| 07 | Polling Throttling | `DashboardClient.tsx`, `LeadsClient.tsx` | ✅ |
| 08 | Stress Test & Cleanup | All files | ✅ |
| 09 | 34-Point Feature Audit | `docs/logs/09-comprehensive-feature-audit.md` | ✅ |
| 10 | 34-Feature Master Plan | `docs/logs/10-implementation-plan.md` | ✅ |
| 11 | Password Auth & bcrypt | `src/app/api/auth/login/route.ts`, `src/lib/auth.ts` | ✅ |
| 12 | Block Caller Exports | `src/app/api/leads/mine/export/route.ts` | ✅ |
| 13 | Security Architecture Audit | `docs/logs/13-security-architecture-and-audit.md` | ✅ |
| 14 | Security Hardening | `src/app/api/leads/[id]/meetings/route.ts` | ✅ |
| 15 | Phone Standardizer | `src/lib/phone.ts` | ✅ |
| 16 | Manual Lead Entry | `src/components/admin/AddLeadDialog.tsx` | ✅ |
| 17 | Lead Activity Timeline | `src/app/api/leads/[id]/timeline/route.ts`, `LeadTimelineDrawer.tsx` | ✅ |
| 18 | Universal File Importer + Custom Fields | `preview/route.ts`, `import/route.ts`, `UploadClient.tsx` | ✅ |
| 19 | Upload UX Improvements | `src/app/admin/upload/UploadClient.tsx` | ✅ |
| 20 | Smart PDF Table Parser (Bug Fix) | `src/app/api/admin/leads/preview/route.ts` | ✅ |

---

## Detailed Change Groups

### 🔐 Group 1: Security Hardening (Features 11–14)

**Problem:** Passwords were stored in plaintext, callers could download other callers' leads, and meeting endpoints had no ownership check.

**Changes:**
- `src/app/api/auth/login/route.ts` — bcrypt hash comparison on login
- `src/lib/auth.ts` — added `assertOwnsLead(leadId, userId)` helper; ADMIN bypasses, USER must own the lead
- `src/app/api/leads/[id]/meetings/route.ts` — added `assertOwnsLead` call
- `src/app/api/leads/mine/export/route.ts` — restricted to caller's own leads only
- All lead-specific API routes now gate access through `assertOwnsLead`

**Security model:**

```
CALLER  → sees only their own leads, history, and exports
ADMIN   → sees everything, all callers, all leads
OTHER   → 403 Forbidden on any lead not assigned to them
```

**Test proof:**
```
Alice→Alice lead:  200 OK   ✅
Alice→Bob lead:    403       ✅
Bob→Alice lead:    403       ✅
Admin→any:         200 OK   ✅
```

---

### 📞 Group 2: Phone Number Standardizer (Feature 15)

**Problem:** Phones like `90000-10001`, `+91 90000 10001`, `09000010001` were all stored differently, causing false duplicate detection failures.

**Changes:**
- `src/lib/phone.ts` — new `cleanPhoneNumber(raw)` function
  - Strips spaces, dashes, brackets
  - Detects +91 / 0 prefix and produces canonical `+919000010001`
  - Also produces national `9000010001` for cross-matching
  - Returns `{ isValid, cleaned, national, reason }`

**Used by:** `preview/route.ts`, `import/route.ts` — both for validation and duplicate detection.

---

### ✍️ Group 3: Manual Lead Entry (Feature 16)

**Problem:** Admin had no way to add a single lead without uploading a file.

**Changes:**
- `src/components/admin/AddLeadDialog.tsx` — new modal dialog (name, phone, has-website, assignee)
  - Real-time phone validation using `cleanPhoneNumber`
  - Duplicate check against DB before saving
- `src/app/admin/leads/LeadsClient.tsx` — added "Add Lead" button
- `src/app/api/admin/leads/route.ts` — POST handler accepts single lead

---

### 📅 Group 4: Lead Activity Timeline (Feature 17)

**Problem:** Admin and callers had no way to see a lead's full history (calls made, notes, follow-ups, WhatsApp messages).

**Changes:**
- `src/app/api/leads/[id]/timeline/route.ts` — new GET endpoint
  - Calls `assertOwnsLead` — strict caller isolation (callers only see their own leads' history)
  - Merges calls + notes + follow-ups + meetings + WhatsApp messages into one sorted array
  - Returns `customFields` for leads imported with extra data
- `src/components/leads/LeadTimelineDrawer.tsx` — new slide-out drawer
  - KPI cards (total calls, follow-ups, meetings)
  - Vertical timeline feed (oldest→newest)
  - Custom fields badge section
- `src/app/dashboard/DashboardClient.tsx` — "Timeline" button on each lead row
- `src/app/admin/leads/LeadsClient.tsx` — "Timeline" button on desktop table, grid cards, and `MoreHorizontal` dropdown

**Security:** `GET /api/leads/[id]/timeline` returns `403` if the caller does not own the lead. Admin always passes through.

---

### 📂 Group 5: Universal File Importer + Custom Fields (Feature 18)

**Problem:** The old CSV importer accepted only a fixed column layout (`name`, `phone`, `hasWebsite`). Any extra column was ignored. PDF and Excel files were unsupported.

**Changes:**
- `prisma/schema.prisma` — added `customFields String?` to `Lead` model (JSON-serialized key-value pairs)
- `src/app/api/admin/leads/preview/route.ts` — full rewrite
  - Accepts `.pdf`, `.xlsx`, `.xls`, `.csv`
  - Auto-detects columns and suggests mapping
  - Admin can override mapping via UI
  - Supports arbitrary custom fields (Location, Budget, City, Source, etc.)
- `src/app/api/admin/leads/import/route.ts` — updated schema accepts `firstInterest`, `customFields`
- `src/app/admin/upload/UploadClient.tsx` — new visual column-mapping step with badge-toggle custom field selector
- `src/components/leads/LeadTimelineDrawer.tsx` — renders custom field badges
- `src/components/admin/LeadDetailDrawer.tsx` — renders custom fields card section
- `src/types/pdfjs-dist.d.ts` — TypeScript declaration for `pdfjs-dist/legacy` mjs modules

---

### 🎨 Group 6: Upload UX Improvements (Feature 19)

**Problem:** The upload page used a plain browser `<input type="file">` with no guidance, no feedback, and the import button was hard to reach on mobile.

**Changes (only `UploadClient.tsx`):**
- Drag-and-drop dropzone with drag-over highlight
- Format-specific file icon (PDF / CSV / Spreadsheet)
- File name + size badge after selection
- One-click `✕` button to clear and re-select
- 3-step visual progress stepper (`Select File` → `Map Columns` → `Preview & Import`)
- Sticky bottom action bar on mobile with valid lead count and import button

---

### 🐛 Group 7: Smart PDF Table Parser Bug Fix (Feature 20)

**Problem:** Uploading a real-world PDF with a document title above the table, wrapped cell text, and footer notes resulted in 0 valid leads and 18 errors — even though all 10 leads had valid phone numbers.

**Root Causes:**
1. `rawRows[0]` was unconditionally used as the header → picked `"DEMO LEADS DATABASE"` (the page title), not the actual column row
2. Strict `Math.round(y)` grouping broke wrapped cells into orphan rows
3. Footer lines were fed into phone validation, adding extra error rows

**Fix in `src/app/api/admin/leads/preview/route.ts`:**
- 5-step positional algorithm using raw `(x, y)` coordinates from pdfjs
- Header detected by keyword-scoring (not by position index)
- Column boundaries from header X-positions (midpoints) — each data item snaps to nearest column
- Data rows clustered with ±10 px Y tolerance (wraps merge correctly)
- Footer/disclaimer lines excluded by pattern matching

**Result:** 10/10 leads extracted correctly, including wrapped cells like `"Lead management CRM"` and `"Appointment booking app"`.

---

## New Files Created

```
docs/
  WORK_LOG.md
  logs/
    01-cloud-region.md through 20-pdf-smart-table-parser.md

src/
  app/api/leads/[id]/timeline/route.ts
  components/admin/AddLeadDialog.tsx
  components/leads/LeadTimelineDrawer.tsx
  types/pdfjs-dist.d.ts
```

---

## Key Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| `customFields` stored as JSON string in SQLite | No schema migration needed when new columns are added in future imports. Flexible. |
| `assertOwnsLead` in `src/lib/auth.ts` (not inline) | Single source of truth for ownership check. Easy to audit. Admin role bypass baked in. |
| pdfjs-dist legacy build (not `pdf-parse`) | `pdf-parse` returns raw concatenated text; pdfjs gives per-item `(x, y)` coordinates, enabling positional table extraction. |
| Sticky import bar mobile-only (`sm:hidden`) | Desktop has enough screen space; mobile users get a floating CTA that saves scrolling. |
| PDF parser: keyword scoring (not position index) for header | Position-based (`rawRows[0]`) broke on any PDF with a title or description before the table. Keyword scoring is robust. |

---

## How to Test

### Manual Test: Upload PDF
1. Go to `http://localhost:3000/admin/upload`
2. Drag and drop `demo_leads_data.pdf` onto the dropzone
3. **Expected:** 10 columns detected, 10 valid leads shown, `Import 10 Valid Leads` button enabled

### Manual Test: Custom Fields
1. Upload `test_leads_sample.xlsx` (in project root)
2. In the "Map Columns" step, toggle extra columns (Company, Source, etc.) as custom fields
3. Import → open any lead → check Custom Fields section in the Lead Detail Drawer

### Manual Test: Caller Isolation
1. Log in as a caller
2. Try to access `GET /api/leads/<lead-not-yours>/timeline` → should get `403 Forbidden`
3. Log in as admin → same URL → should get `200 OK`

---

## Build

```
npm run build
✓ Compiled successfully in 13.1s
✓ TypeScript check passed in 9.9s
✓ 27 pages generated, 0 errors
Exit Code: 0
```
