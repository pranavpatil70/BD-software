# 🛡️ Callopss Security Architecture & Protection Matrix

**Document Version:** 1.0  
**Security Classification:** Strict Two-Tier Access Control (`ADMIN` & `CALLER`)  
**Status:** Verified via Live Automated Penetration Testing

---

## 1. Strictly Protected Assets & Isolation Rules

Under the 2-tier architecture, **all caller data is strictly isolated into private silos**. No caller can ever view, edit, or tamper with another caller's work.

### Access Control Matrix

| System Asset | Caller (Agent) | Admin | Security Mechanism |
| :--- | :---: | :---: | :--- |
| **Own Assigned Leads** | ✅ View & Edit | ✅ View & Edit | Scoped query: `where: { assignedToId: session.id }` |
| **Colleague's Leads** | ❌ **STRICTLY BLOCKED** | ✅ View & Edit | Guard function: `assertOwnsLead(leadId, session.id)` |
| **Unassigned Leads** | ❌ **STRICTLY BLOCKED** | ✅ View & Assign | Guard function: `assertOwnsLead(leadId, session.id)` |
| **Meetings Fixed** | ✅ View Own Only | ✅ View All | Lead ownership validation + scoped queries |
| **Call Logs & Notes** | ✅ View Own Only | ✅ View All | User ownership validation: `call.userId === session.id` |
| **Follow-up Reminders** | ✅ View Own Only | ✅ View All | Lead ownership validation on slot update/fetch |
| **Export / Download CSV** | ❌ **STRICTLY BLOCKED (403)** | ✅ Allowed | Route lock: `/api/leads/mine/export` returns 403 Forbidden |
| **User & Team Management** | ❌ **STRICTLY BLOCKED** | ✅ Full Control | Route lock: `/api/admin/users/*` requires Admin role |
| **Raw Lead Uploads** | ❌ **STRICTLY BLOCKED** | ✅ Allowed | Route lock: `/api/admin/leads/import` requires Admin role |

---

## 2. Security Measures Implemented To Date

### 1. Password Hashing with bcrypt (`S4`)
* User passwords are encrypted using `bcryptjs` with a cost factor (salt rounds) of 10.
* Passwords are never stored in plaintext in the database or server logs.
* Validation is enforced on `POST /api/auth/login`.

### 2. Login Audit Logging (`S8`)
* Every authentication attempt (successful or failed) is tracked in the `ActivityLog` table.
* Audit entries capture:
  * `userId`: ID of the authenticated user.
  * `ip`: Client IP address (`x-forwarded-for` or socket address).
  * `userAgent`: Browser and operating system identifier.
  * `createdAt`: Precise timestamp.

### 3. Customer Data Export Prevention (`S12 & R9`)
* All export endpoints accessible to Callers have been locked down.
* Calls to `/api/leads/mine/export` return **HTTP 403 Forbidden**.
* The "Export CSV" button has been completely removed from the Caller UI dashboard (`DashboardClient.tsx`).
* Only Admins can export data, and every export is recorded in `ActivityLog` with filter parameters and record count.

### 4. Co-located Cloud Infrastructure in India (`S1 & S6`)
* Web servers deployed to Vercel Mumbai (`bom1`).
* Database hosted in AWS Mumbai (`aws-ap-south-1`).
* Communications secured over HTTPS with TLS 1.2 / TLS 1.3 edge certificates.

---

## 3. Live Security Penetration Test Results

We conducted live automated intrusion tests where Caller 1 (`alice`) attempted to access and tamper with Caller 2 (`bob`'s) data:

```
[TEST 1] Alice attempts to read Bob's meetings       ➔ 🛡️ BLOCKED (Unauthorized)
[TEST 2] Alice attempts to schedule on Bob's lead    ➔ 🛡️ BLOCKED (Unauthorized)
[TEST 3] Alice attempts to log a call on Bob's lead   ➔ 🛡️ BLOCKED (Unauthorized)
[TEST 4] Alice attempts to change Bob's lead status   ➔ 🛡️ BLOCKED (HTTP 403 Forbidden)
[TEST 5] Alice attempts to access unassigned lead     ➔ 🛡️ BLOCKED (Unauthorized)
[TEST 6] Alice attempts to download leads CSV         ➔ 🛡️ BLOCKED (HTTP 403 Forbidden)
```

**Result:** **0 Data Leaks Detected.** Data isolation between callers is 100% active.

---

## 4. Hardening Roadmap: All 3 Issues Resolved & Verified

All 3 security hardening refinements have been implemented, live-tested, and verified:

### Issue 1: Explicit Meeting Ownership in Database
* **Status:** ✅ **Completed & Verified**
* **Implementation:** Added `userId String?` with relation `user User?` on `Meeting` in `prisma/schema.prisma` with indexes `@@index([userId])`, `@@index([leadId])`. Synchronized database with `prisma db push` and regenerated Prisma Client. Updated `src/app/api/leads/[id]/meetings/route.ts` to assign `userId: session.id` and include `user: { id, displayName }` in output.
* **Benefit:** Admins can see exactly which caller scheduled each meeting, even if the lead is subsequently reassigned.

### Issue 2: Clean HTTP 403 Responses on Intrusion Attempts
* **Status:** ✅ **Completed & Verified**
* **Implementation:** Updated `assertOwnsLead` in `src/lib/auth.ts` to throw `ApiError(403, 'Forbidden: You do not have access to this lead')`. Updated `src/lib/api-error.ts` to handle and map `Forbidden` errors to HTTP 403. Updated `src/app/api/leads/[id]/meetings/route.ts` to use `handleApiError(error)`.
* **Benefit:** Clean `HTTP 403 Forbidden` JSON returned on unauthorized caller intrusion attempts into calls or meetings.

### Issue 3: API Route Explicit 403/401 vs HTML Redirect
* **Status:** ✅ **Completed & Verified**
* **Implementation:** Enabled `experimental: { authInterrupts: true }` in `next.config.ts`. Updated `requireAdmin()` and `requireAuth()` in `src/lib/auth.ts` to inspect incoming headers: API requests (`!isPage`) invoke native `forbidden()` (`403 Forbidden`) and `unauthorized()` (`401 Unauthorized`), while UI browser navigations redirect to `/dashboard` or `/login`.
* **Benefit:** REST clients receive immediate standard HTTP 403/401 status codes instead of HTML redirects. Full technical details in [Log 14](./logs/14-security-hardening-applied.md).
