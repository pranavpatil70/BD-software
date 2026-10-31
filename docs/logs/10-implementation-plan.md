# WORK-010: 34-Feature Master Implementation Plan

* **Status:** ✅ `PLAN APPROVED FOR EXECUTION`
* **Date:** 2026-10-28
* **Purpose:** Outline the phased technical roadmap for implementing all 34 requirements across Security (S1–S13), Bulk Import (D1–D12), and Reports (R1–R10).

---

### 1. Phased Architecture Breakdown
* **Phase 1: Security, Roles & Authentication (S4, S5, S7, S11, S12, R9)**
  * Passwords with bcrypt hashing + Admin 2FA.
  * Three-tier roles (`ADMIN`, `TEAM_LEADER`, `CALLER`).
  * Inactivity auto-logout and blocking Caller downloads.
* **Phase 2: Intelligent Bulk Lead Import Engine (D1–D12)**
  * Indian phone number cleaner (+91 strip, multi-split, regex).
  * Interactive column mapping screen with reusable profiles.
  * Phone-only mandatory rule + `extraFields` JSON column.
  * Manual customer entry modal.
* **Phase 3: Reports, Win Rate & Lead Timeline (R1–R10)**
  * Funnel statuses: `NEW`, `IN_PROGRESS`, `WON`, `LOST`.
  * Win Rate KPI tile with `Won ÷ (Won + Lost)` formula display.
  * Excel `.xlsx` multi-sheet formatted exports + download audit log.
  * Chronological visual timeline of all calls, notes, and status changes.
* **Phase 4: Data Governance & Compliance (S3, S13)**
  * Application-layer field-level encryption (AES-256-GCM) with HMAC search hash.
  * Permanent deletion ("Forget Lead") compliance API.

---

### 2. Full Plan Reference
* See full architectural blueprint in [`docs/IMPLEMENTATION_PLAN.md`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/docs/IMPLEMENTATION_PLAN.md).
