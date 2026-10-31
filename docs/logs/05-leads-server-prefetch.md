# WORK-005: Leads Page Server Pre-fetching

* **Status:** ✅ `PASSED`
* **Date:** 2026-10-27
* **Purpose:** Eliminate double-fetch waterfall and initial loading spinners on `/admin/leads`.

---

### 1. The Problem & Technical Root Cause
The page previously delivered an empty table shell to the browser; a client-side `useEffect` then sent a second network request to `/api/admin/leads`, forcing users to wait twice.

### 2. Files Changed
* [`src/app/admin/leads/page.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/admin/leads/page.tsx#L8-L55)
* [`src/app/admin/leads/LeadsClient.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/admin/leads/LeadsClient.tsx#L72-L91,L229-L235)

### 3. Code Modifications
* `page.tsx`: Pre-fetches first 25 leads and total count concurrently on the server via `Promise.all`.
* `LeadsClient.tsx`: Accepts `initialRows` and `initialTotalCount` props and skips the initial client-side network request.

### 4. Output & Impact
The initial table data is embedded directly in the first server-rendered HTML response.

### 5. Verification Proof
* Verified in browser: 0ms initial spinner duration; table appears populated instantly.
