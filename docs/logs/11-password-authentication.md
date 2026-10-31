# WORK-011: Password Authentication & bcrypt Hashing (S4 & S8)

* **Status:** ✅ `IMPLEMENTED & TESTED`
* **Date:** 2026-10-28
* **Requirement:** `S4 — Hash passwords using bcrypt or Argon2` & `S8 — Activity logs for logins`

---

### 1. The Problem & Why It Needed Fixing
Previously, the `/api/auth/login` endpoint only required a `username` string without a password. Anyone knowing a username could log in without verification. Furthermore, successful logins were not logged into the database `ActivityLog`.

### 2. Exact Files & Lines Changed

| File Changed | Line Numbers | Modification Made |
| :--- | :--- | :--- |
| [`prisma/schema.prisma`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/prisma/schema.prisma#L15) | Line 15 | Added `passwordHash String?` to the `User` model. |
| [`prisma/seed.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/prisma/seed.ts#L6-L45) | Lines 6–45 | Added `bcrypt.hash()` for seeded accounts (`admin`, `piyush`, `alice`, `bob`). |
| [`src/app/api/auth/login/route.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api/auth/login/route.ts#L8-L58) | Lines 8–58 | Added `password` to validation schema, bcrypt comparison (`bcrypt.compare`), and login audit record in `ActivityLog`. |
| [`src/app/login/page.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/login/page.tsx#L10-L75) | Lines 10–75 | Added password state and password `<Input type="password">` field to login form. |

### 3. Default Seed Credentials (Local & Dev)
* **Admins (`admin`, `piyush`):** Password: `Admin@123`
* **Callers (`alice`, `bob`):** Password: `Caller@123`

### 4. Output & Direct Impact
* Unauthenticated or incorrect password attempts return **HTTP 401 Unauthorized**.
* Valid logins issue secure session cookies and log an audit record to `ActivityLog` with timestamp, user ID, IP, and user-agent.

### 5. Verification Proof
1. **API Valid Password Test:**
   * `POST /api/auth/login` (`admin`, `Admin@123`) ➔ **HTTP 200** with `{ role: "ADMIN" }` ✅
2. **API Wrong Password Test:**
   * `POST /api/auth/login` (`admin`, `WrongPassword!`) ➔ **HTTP 401 Unauthorized** ✅
3. **API Caller Login Test:**
   * `POST /api/auth/login` (`alice`, `Caller@123`) ➔ **HTTP 200** with `{ role: "USER" }` ✅
4. **Database Audit Log Test:**
   * Queried `prisma.activityLog.findMany({ where: { action: 'LOGIN' } })` ➔ 2 login logs verified with IP and timestamp ✅
5. **Production Build:**
   * `npm run build` passed with **exit code 0** across all 27 routes ✅
