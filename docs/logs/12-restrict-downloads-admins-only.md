# WORK-012: Restrict Downloads to Admins & Block Caller Exports (S12 & R9)

* **Status:** ✅ `IMPLEMENTED & TESTED`
* **Date:** 2026-10-28
* **Requirement:** `S12 — Restrict lead imports and exports to Admins` & `R9 — Restrict Callers to their own numbers and prevent downloads`

---

### 1. The Problem & Why It Needed Fixing
Previously, the endpoint `/api/leads/mine/export` allowed regular callers (`requireUser()`) to export their assigned leads to a CSV file. In addition, an "Export CSV" button was rendered on the Caller dashboard (`/dashboard`), exposing proprietary customer phone numbers to offline export.

### 2. Exact Files & Lines Changed

| File Changed | Line Numbers | Modification Made |
| :--- | :--- | :--- |
| [`src/app/api/leads/mine/export/route.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api/leads/mine/export/route.ts#L1-L20) | Lines 1–20 | Replaced caller export query with strict Admin-only validation. Returns **HTTP 403 Forbidden** for Callers. |
| [`src/app/dashboard/DashboardClient.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/dashboard/DashboardClient.tsx#L10-L16,L288-L295,L540-L550) | Lines 10–16, 288–295 | Removed `ExportLeadsDialog` import, removed `exportDialogOpen` state, and deleted the "Export CSV" button from the caller dashboard UI. |
| [`src/components/leads/ExportLeadsDialog.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/components/leads/ExportLeadsDialog.tsx#L10-L85) | Lines 10–85 | Configured dialog to route exclusively to the authorized `/api/admin/leads/export` endpoint. |

### 3. Output & Direct Impact
* Callers (`role: USER`) opening their dashboard no longer see any "Export CSV" buttons.
* Any direct API attempts by Callers or unauthenticated actors to access `/api/leads/mine/export` receive an immediate **HTTP 403 Forbidden** error.
* Administrators (`role: ADMIN`) retain full export capabilities via the protected `/admin/leads` portal with comprehensive audit logging.

### 4. Verification Proof
1. **Caller Download Block Test:**
   * Logged in as caller (`alice`, `Caller@123`).
   * Attempted `GET /api/leads/mine/export` ➔ **HTTP 403 Forbidden** (`Caller export blocked with Status Code: 403`) ✅
2. **Admin Download Access Test:**
   * Logged in as admin (`admin`, `Admin@123`).
   * Executed `GET /api/admin/leads/export?statuses=HOT,WARM,CONVERTED` ➔ **HTTP 200 OK** with valid CSV payload ✅
3. **UI Verification:**
   * Verified that the "Export CSV" button is completely removed from `/dashboard` ✅
4. **Production Build:**
   * `npm run build` compiled with **exit code 0** across all 27 routes ✅
