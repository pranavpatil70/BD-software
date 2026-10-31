# Comprehensive Feature & Security Audit

This document audits the Callopss codebase against the 34 specification requirements across **Security & Access Control (S1–S13)**, **Bulk Lead Import (D1–D12)**, and **Reports & Lead History (R1–R10)**.

**Audit Status Legend:**
* ✅ **PRESENT & VERIFIED:** Fully implemented and functioning in code.
* 🟡 **PARTIALLY PRESENT:** Basic or primitive version exists, but misses key criteria.
* ❌ **NOT PRESENT (GAP):** Missing entirely from codebase; needs implementation.

---

## 1. Security & Access Control Audit

| ID | Requirement | Current Status | Codebase Findings & Gaps |
| :-: | :--- | :---: | :--- |
| **S1** | **Enable HTTPS with TLS 1.2+** | ✅ **PRESENT** | Handled natively by Vercel / Cloudflare edge routing with automatic TLS 1.3/1.2 SSL certs. |
| **S2** | **Encrypt stored data and backups** | ✅ **PRESENT** | Handled by Turso / LibSQL (AES-256 at rest) and AWS EBS encryption in Mumbai (`aws-ap-south-1`). |
| **S3** | **Field-level encryption for phone & email** | ❌ **NOT PRESENT** | Contacts are stored as plaintext strings in SQLite/Turso. Needs application-level AES-GCM or KMS envelope encryption. |
| **S4** | **Hash passwords using bcrypt / Argon2** | ✅ **PRESENT** | Passwords hashed using `bcryptjs` with salt round 10, validated on `/api/auth/login`. |
| **S5** | **2FA for Admins & strong password policies** | ❌ **NOT PRESENT** | No 2FA (TOTP/authenticator or SMS/email OTP) or password strength validation exists. |
| **S6** | **Cloud hosting in India, firewall, private DB** | ✅ **PRESENT** | Vercel Mumbai (`bom1`) + Turso DB Mumbai (`aws-ap-south-1`) configured and verified. |
| **S7** | **Login attempt limits & auto-logout** | 🟡 **PARTIAL** | In-memory IP rate limiter exists (`rateLimitKey`, 10 reqs). No persistent user lockout or inactivity timeout session invalidation. |
| **S8** | **Activity logs for logins, views, imports, exports** | 🟡 **PARTIAL** | Imports, exports, and status changes write to `ActivityLog`. Logins and lead views (`DATA_VIEW`) are NOT logged to database. |
| **S9** | **Independent security testing before pilot** | ❌ **PROCEDURAL** | Operational requirement; pending automated security testing suite / pentest report. |
| **S10** | **Document security breach response plan** | ❌ **NOT PRESENT** | Needs formal documentation file in `docs/SECURITY_BREACH_PLAN.md`. |
| **S11** | **Admin, Team Leader, and Caller roles** | 🟡 **PARTIAL** | `User.role` only supports `"ADMIN"` and `"USER"`. Lacks `"TEAM_LEADER"` and `"CALLER"` hierarchical permissions. |
| **S12** | **Restrict lead imports & exports to Admins** | ✅ **PRESENT** | Both imports and exports are locked strictly to Admins; Callers receive HTTP 403 Forbidden. |
| **S13** | **Data export & permanent deletion on request** | 🟡 **PARTIAL** | CSV export exists. Cascade deletion exists in schema (`onDelete: Cascade`), but lacks single-click "Forget/Erase Lead" GDPR/DPDP endpoint. |

---

## 2. Bulk Lead Import Audit

| ID | Requirement | Current Status | Codebase Findings & Gaps |
| :-: | :--- | :---: | :--- |
| **D1** | **Bulk CSV & Excel uploads without fixed template** | 🟡 **PARTIAL** | Supports `.csv` and `.xlsx` via `xlsx` library, but column headers are matched against hardcoded names. |
| **D2** | **Auto-detect columns using headers & patterns** | 🟡 **PARTIAL** | Basic keyword match (`includes('name')`, `includes('contact')`). Does not inspect regex phone patterns or fuzzy header names. |
| **D3** | **Column-mapping screen to confirm or correct** | ❌ **NOT PRESENT** | UI jumps directly from file select to preview table. Users have no interactive dropdowns to map source columns to lead fields. |
| **D4** | **Make phone number only mandatory field** | ❌ **NOT PRESENT** | Code strictly checks `if (!name) status = 'error'`, causing rows without names to fail. |
| **D5** | **Save unknown columns as extra fields** | ❌ **NOT PRESENT** | Schema only has fixed fields. Unknown columns in CSV/Excel are ignored and dropped. Needs `extraFields` JSON column. |
| **D6** | **Save reusable column mappings** | ❌ **NOT PRESENT** | No `ColumnMapping` model or feature to remember mappings for recurring vendor sheets. |
| **D7** | **Clean phone numbers (spaces, +91, split multi-numbers)** | ❌ **NOT PRESENT** | Only does `.trim()`. Does not strip `+91` or spaces, does not validate 10-digit Indian numbers, and does not split multi-phone cells. |
| **D8** | **Import preview with fix/skip options** | 🟡 **PARTIAL** | Displays error list, but user cannot edit/fix values inline before submitting. |
| **D9** | **Detect duplicates against existing leads** | 🟡 **PARTIAL** | Checks existing DB numbers, but uses raw uncleaned strings without phone normalization. |
| **D10** | **Manual customer-entry form with extra fields** | ❌ **NOT PRESENT** | No manual single-lead entry modal/form exists in the UI. |
| **D12** | **Tag every import with source and date** | 🟡 **PARTIAL** | Stores `csvName` string, but lacks structured source tagging, import batch tracking, and timestamping. |

---

## 3. Reports & Lead History Audit

| ID | Requirement | Current Status | Codebase Findings & Gaps |
| :-: | :--- | :---: | :--- |
| **R1** | **Statuses: New, In Progress, Won, Lost** | ❌ **NOT PRESENT** | Schema uses: `NEW`, `HOT`, `WARM`, `COLD`, `NOT_INTERESTED`, `CONVERTED`, `NOT_RECEIVED`. Needs status unification or mapping. |
| **R2** | **Admin configure Won/Lost criteria per campaign** | ❌ **NOT PRESENT** | No campaign configuration model or custom status threshold rules. |
| **R3** | **Dashboard showing Total, In Progress, Won, Lost, Win Rate** | ❌ **NOT PRESENT** | KPI cards currently show: Total Calls, Active Users, Conversion Rate, Hot Leads. |
| **R4** | **Calculate Win Rate as Won ÷ (Won + Lost) & show formula** | ❌ **NOT PRESENT** | Conversion rate is currently `converted / totalLeads`. Formula `Won ÷ (Won + Lost)` is not displayed. |
| **R5** | **Filters: date range, caller, team, source list, city** | 🟡 **PARTIAL** | Has date range and assignee filters. Missing `team`, `source list`, and `city` filters. |
| **R6** | **Reopen historical reports for past dates** | ❌ **NOT PRESENT** | Cannot save snapshot reports or query reports as-of an arbitrary historical date. |
| **R7** | **Support report downloads in Excel format** | 🟡 **PARTIAL** | Exports are raw `.csv` format only. Does not generate binary `.xlsx` files with sheets and styling. |
| **R8** | **Timeline of calls, outcomes, notes, status changes** | 🟡 **PARTIAL** | `Call` logs exist, but there is no unified chronological visual timeline component combining calls, notes, and status changes. |
| **R9** | **Admins & Team Leaders view all; Callers restricted** | ❌ **NOT PRESENT** | Callers can still access export endpoints; no Team Leader scoping logic exists. |
| **R10** | **Log every report download** | 🟡 **PARTIAL** | Logs to `ActivityLog`, but lacks dedicated download auditing (file type, IP, scope, filters used). |

---

## 4. Summary Scorecard

* ✅ **Fully Implemented:** 4 / 34 requirements (12%)
* 🟡 **Partially Implemented:** 11 / 34 requirements (32%)
* ❌ **Missing / Needs Building:** 19 / 34 requirements (56%)
