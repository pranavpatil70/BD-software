# Log 14: Security Hardening Applied (Explicit Meeting Ownership & Clean 403 Forbidden)

**Date**: 2026-10-28  
**Task Ref**: Security Audit Hardening (Issues 1, 2, 3)  
**Status**: Completed & Verified  

---

## 1. Problem Overview & Hardening Objectives
During the security isolation penetration testing between callers (Alice & Bob) and Admin, three specific hardening items were identified:
1. **Issue 1 (Meeting Ownership Tracking)**: The `Meeting` model had a `leadId` but no `userId`. When an Admin inspected meetings, they could not ascertain which specific caller booked each meeting.
2. **Issue 2 (HTTP Status Code Fidelity on Intrusion)**: When an unauthorized caller attempted to log a call or schedule a meeting on another caller's lead, the error handler returned an HTTP 500 Internal Server Error instead of a REST-compliant `HTTP 403 Forbidden`.
3. **Issue 3 (REST API Protection vs Page Redirection)**: In `src/lib/auth.ts`, `requireAdmin()` and `requireAuth()` invoked `redirect()`. When non-admins called `/api/admin/...` endpoints, Next.js returned an HTTP 307 Temporary Redirect to HTML `/dashboard` or `/login` rather than a standard REST `HTTP 403 Forbidden` / `401 Unauthorized` response.

---

## 2. Solutions Implemented

### Solution 1: Explicit Meeting Ownership (`userId` on `Meeting`)
- **File**: `prisma/schema.prisma`
  - Added `userId String?` with relation `user User? @relation(fields: [userId], references: [id], onDelete: SetNull)` on `Meeting`.
  - Added indexes: `@@index([userId])` and `@@index([leadId])`.
  - Applied schema to database using `npx prisma db push` and regenerated Prisma Client with `npx prisma generate`.
- **File**: `src/app/api/leads/[id]/meetings/route.ts`
  - In `POST`, saved `userId: session.id` during meeting creation.
  - In both `GET` and `POST`, included relation `user: { select: { id: true, displayName: true } }`.

### Solution 2: Clean HTTP 403 Forbidden on Unauthorized Caller Intrusion
- **File**: `src/lib/auth.ts`
  - Updated `assertOwnsLead(leadId, userId)`:
    - Throws `new ApiError(404, 'Lead not found')` if the lead does not exist.
    - Throws `new ApiError(403, 'Forbidden: You do not have access to this lead')` if a non-admin caller attempts to access another caller's lead.
- **File**: `src/lib/api-error.ts`
  - Updated `handleApiError(err)`:
    - Rethrows Next.js internal control-flow errors (digests starting with `NEXT_`).
    - Catches `ApiError` instances and returns status code directly (`err.status`).
    - Parses standard `Error` messages starting with `Forbidden` (`status: 403`), `Unauthorized` (`status: 401`), and `not found` (`status: 404`).
- **File**: `src/app/api/leads/[id]/meetings/route.ts`
  - Replaced manual error branching with unified `handleApiError(error)` in both `GET` and `POST`.

### Solution 3: Direct HTTP 403/401 on API Routes
- **File**: `next.config.ts`
  - Enabled Next.js native `experimental: { authInterrupts: true }`.
- **File**: `src/lib/auth.ts`
  - Updated `requireAdmin()` and `requireAuth()` to inspect incoming request headers:
    - If request is a UI browser page request (`Accept: text/html`), safely redirects via `redirect('/dashboard')` or `redirect('/login')`.
    - If request is an API request (`!isPage`), invokes native `forbidden()` (`HTTP 403`) or `unauthorized()` (`HTTP 401`).

---

## 3. Verification & Live Test Evidence

| Test Scenario | Endpoint & Role | Expected Status | Actual Result |
| :--- | :--- | :--- | :--- |
| **Alice tries to access Bob's meetings** | `GET /api/leads/<bob-lead>/meetings` (Alice) | `403 Forbidden` | `HTTP/1.1 403 Forbidden` `{"error":"Forbidden: You do not have access to this lead"}` |
| **Alice tries to schedule meeting on Bob's lead** | `POST /api/leads/<bob-lead>/meetings` (Alice) | `403 Forbidden` | `HTTP/1.1 403 Forbidden` `{"error":"Forbidden: You do not have access to this lead"}` |
| **Alice tries to log call on Bob's lead** | `POST /api/leads/<bob-lead>/call` (Alice) | `403 Forbidden` | `HTTP/1.1 403 Forbidden` `{"error":"Forbidden: You do not have access to this lead"}` |
| **Bob schedules meeting on his own lead** | `POST /api/leads/<bob-lead>/meetings` (Bob) | `200 OK` | `HTTP/1.1 200 OK` `meeting.userId: "cmvryo0hd..."`, `user.displayName: "Bob"` |
| **Bob logs call on his own lead** | `POST /api/leads/<bob-lead>/call` (Bob) | `200 OK` | `HTTP/1.1 200 OK` `{"callId":"...","callCount":4}` |
| **Admin views Bob's lead meetings** | `GET /api/leads/<bob-lead>/meetings` (Admin) | `200 OK` | `HTTP/1.1 200 OK` Meeting details with Bob as creator |
| **Alice calls Admin leads API** | `GET /api/admin/leads` (Alice) | `403 Forbidden` | `HTTP/1.1 403 Forbidden` |
| **Alice calls Admin users API** | `GET /api/admin/users` (Alice) | `403 Forbidden` | `HTTP/1.1 403 Forbidden` |
| **Alice calls Admin export API** | `GET /api/admin/leads/export` (Alice) | `403 Forbidden` | `HTTP/1.1 403 Forbidden` |
| **Unauthenticated calls Admin leads API** | `GET /api/admin/leads` (No Session) | `401 Unauthorized` | `HTTP/1.1 401 Unauthorized` |
| **Alice navigates to Admin page in Browser** | `GET /admin/dashboard` (Accept: text/html) | `307 Redirect` | `NEXT_REDIRECT;/dashboard;307` |
| **Production Build Compilation** | `npm run build` | Exit Code 0 | All 27 routes compiled clean with 0 TS errors |

---

## 4. Conclusion
All 3 hardening points have been fully resolved, verified via live intrusion tests, and pass full production compilation.
