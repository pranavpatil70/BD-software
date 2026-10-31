# PR: Lead Management v2

**Branch:** `feature/lead-management-v2` → `main`  
**Date:** 2026-10-31  
**Build:** ✅ `npm run build` — Exit Code 0, 0 TypeScript errors

---

## What This PR Does

This branch adds security hardening, a phone standardizer, manual lead entry, a lead activity timeline, a universal file importer (CSV/Excel/PDF), upload UX improvements, and a critical PDF parser bug fix.

Full feature-by-feature detail is in [`docs/WORK_LOG.md`](./WORK_LOG.md) and the individual logs in [`docs/logs/`](./logs/).

---

## Features Shipped

### 🔐 Security (Features 11–14)
- **bcrypt login** — passwords compared with bcrypt (no more plaintext)
- **Caller isolation** — `assertOwnsLead(leadId, userId)` in `src/lib/auth.ts` enforced on every lead endpoint. Callers get `403` on any lead not assigned to them.
- **Admin bypass** — `ADMIN` role passes all ownership checks automatically
- **Export restricted** — only Admins can download lead CSVs

📄 Detail: [11-password-authentication.md](./logs/11-password-authentication.md) · [12-restrict-downloads-admins-only.md](./logs/12-restrict-downloads-admins-only.md) · [13-security-architecture-and-audit.md](./logs/13-security-architecture-and-audit.md) · [14-security-hardening-applied.md](./logs/14-security-hardening-applied.md)

---

### 📞 Phone Standardizer (Feature 15)
- New `cleanPhoneNumber()` in `src/lib/phone.ts`
- Handles `+91 90000 10001`, `09000010001`, `90000-10001` → canonical `+919000010001`
- Used for validation and duplicate detection during import

📄 Detail: [15-phone-number-standardizer.md](./logs/15-phone-number-standardizer.md)

---

### ✍️ Manual Lead Entry (Feature 16)
- New **Add Lead** button in Admin → Leads
- `AddLeadDialog.tsx` with real-time phone validation and DB duplicate check
- No file upload needed for single leads

📄 Detail: [16-manual-lead-entry.md](./logs/16-manual-lead-entry.md)

---

### 📅 Lead Activity Timeline (Feature 17)
- New endpoint: `GET /api/leads/[id]/timeline`
  - Enforces `assertOwnsLead` — callers see only their own leads' history
  - Merges calls, notes, follow-ups, meetings, WhatsApp messages in chronological order
- New `LeadTimelineDrawer.tsx` slide-out panel with KPI cards + timeline feed
- **Timeline** button added to Caller Dashboard and Admin Leads table

📄 Detail: [17-lead-history-timeline.md](./logs/17-lead-history-timeline.md)

---

### 📂 Universal File Importer + Custom Fields (Feature 18)
- Upload page now accepts **CSV, Excel (.xlsx/.xls), and PDF**
- Auto-detects columns and suggests mapping (admin can override)
- **Custom Fields freedom** — any extra column (Location, Budget, City, Source…) can be toggled and stored per lead as JSON
- `prisma/schema.prisma`: added `customFields String?` to `Lead` model
- Custom fields visible in Lead Detail Drawer and Timeline

📄 Detail: [18-universal-file-importer-and-custom-fields.md](./logs/18-universal-file-importer-and-custom-fields.md)

---

### 🎨 Upload UX Improvements (Feature 19)
- Replaced plain `<input type="file">` with a **drag-and-drop dropzone**
- **3-step progress stepper** → `Select File` → `Map Columns` → `Preview & Import`
- File card shows name, size, format icon + **one-click reset** (`✕` button)
- **Sticky mobile import bar** — import button floats at the bottom on phones

📄 Detail: [19-upload-ux-improvements.md](./logs/19-upload-ux-improvements.md)

---

### 🐛 PDF Parser Bug Fix (Feature 20)

**Problem:** Uploading a real-world PDF (`demo_leads_data.pdf`) returned 0 valid leads and 18 errors despite having 10 valid leads with correct phone numbers.

**Root causes found:**
1. `rawRows[0]` was always used as the column header → on this PDF it grabbed `"DEMO LEADS DATABASE"` (the page title), not the actual table header row
2. Strict `Math.round(y)` grouping split wrapped cells (e.g. `"Lead management"` / `"CRM"` on two y-coordinates) into orphan rows that failed phone validation
3. Footer disclaimer lines were fed into the phone validator

**Fix applied in `src/app/api/admin/leads/preview/route.ts`:**
- Replaced the old line-split approach with a **5-step positional algorithm** using raw `(x, y)` coordinates from pdfjs-dist
- Header row detected by **keyword scoring** (not by position index) — skips title/subtitle lines automatically
- Data items assigned to columns via **X-boundary midpoints** from the header row
- Wrapped cells merged correctly within **±10 px Y tolerance**
- Footers excluded by pattern matching

**Result:** `demo_leads_data.pdf` → 10/10 valid leads, 0 errors ✅

📄 Detail: [20-pdf-smart-table-parser.md](./logs/20-pdf-smart-table-parser.md)

---

## Files Changed

| File | Type | Reason |
|------|------|--------|
| `src/lib/auth.ts` | Modified | Added `assertOwnsLead()` |
| `src/lib/phone.ts` | Modified | New `cleanPhoneNumber()` |
| `src/app/api/auth/login/route.ts` | Modified | bcrypt password check |
| `src/app/api/leads/[id]/timeline/route.ts` | **New** | Timeline endpoint |
| `src/app/api/leads/mine/export/route.ts` | Modified | Admin-only export |
| `src/app/api/leads/[id]/meetings/route.ts` | Modified | Ownership check |
| `src/app/api/admin/leads/preview/route.ts` | Modified | Smart PDF parser + multi-format |
| `src/app/api/admin/leads/import/route.ts` | Modified | Custom fields + firstInterest |
| `src/app/api/admin/leads/route.ts` | Modified | Single lead POST |
| `src/app/admin/upload/UploadClient.tsx` | Modified | Drag-drop + stepper + UX |
| `src/app/admin/leads/LeadsClient.tsx` | Modified | Timeline button + Add Lead |
| `src/app/dashboard/DashboardClient.tsx` | Modified | Timeline button |
| `src/components/admin/AddLeadDialog.tsx` | **New** | Manual lead entry dialog |
| `src/components/leads/LeadTimelineDrawer.tsx` | **New** | Timeline slide-out panel |
| `src/components/admin/LeadDetailDrawer.tsx` | Modified | Custom fields section |
| `src/types/pdfjs-dist.d.ts` | **New** | TypeScript declarations for pdfjs |
| `prisma/schema.prisma` | Modified | `customFields String?` on Lead |

---

## How to Test

```bash
# 1. Start dev server
cd partiklatthi64
npm run dev

# 2. Test PDF upload
# Go to http://localhost:3000/admin/upload
# Drop demo_leads_data.pdf → should show 10 valid leads

# 3. Test caller isolation
# Log in as a caller → try to open a lead not assigned to them → should get 403

# 4. Test timeline
# Admin → Leads → click "Timeline" on any lead → drawer opens with history
```
