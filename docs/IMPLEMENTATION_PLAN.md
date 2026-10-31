# 🗺️ Callopss 34-Feature Master Implementation Plan

This roadmap outlines the exact phased architecture and implementation plan to deliver all 34 requirements across **Security (S1–S13)**, **Bulk Import (D1–D12)**, and **Reports & Analytics (R1–R10)**.

---

## 🎯 Architecture Principles
1. **Preserve High Performance:** Every new database query must use indexed columns ($O(\log N)$) and avoid regressions to the 1ms–4ms query times achieved in previous sprints.
2. **Backward Compatibility:** Existing 811 demo leads and users must remain functional throughout schema migrations.
3. **Strict Separation of Concerns:** Server components handle pre-fetching and security gating; client components handle interactive mapping, filtering, and state.
4. **Zero-Trust Security:** Role permissions validated on both API route handlers and server components.

---

## 🚀 Phased Execution Roadmap

```
  ┌─────────────────────────────────────────────────────────────┐
  │ PHASE 1: Security, Roles & Authentication (S4, S5, S7, S11) │
  │ - Password hashing (bcrypt) + Admin 2FA                     │
  │ - Roles: ADMIN, TEAM_LEADER, CALLER                         │
  │ - Strict route authorization & download blocking            │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ PHASE 2: Intelligent Bulk Lead Import Engine (D1 – D12)     │
  │ - Phone cleaner (+91 strip, multi-split, regex validation)  │
  │ - Interactive column mapping screen + saved mappings        │
  │ - Phone-only mandatory rule + extraFields JSON storage      │
  │ - Manual customer-entry modal with custom fields            │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ PHASE 3: Reports, Win Rate & Lead Timeline (R1 – R10)       │
  │ - Unified statuses: New, In Progress, Won, Lost             │
  │ - Win Rate KPI card: Won ÷ (Won + Lost) + formula display   │
  │ - Excel (.xlsx) styled downloads + audit logging            │
  │ - Lead timeline combining calls, notes, and status changes  │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ PHASE 4: Data Governance, Encryption & Compliance (S3, S13) │
  │ - Field-level encryption for phone/email (AES-256-GCM)      │
  │ - Permanent lead deletion ("Forget Lead") compliance API    │
  │ - Security breach response documentation (docs/SECURITY.md) │
  └─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Security, Roles & Authentication (S4, S5, S7, S11, S12, R9)

### 1. Database Schema Updates (`prisma/schema.prisma`)
* Update `User`:
  ```prisma
  model User {
    id             String    @id @default(cuid())
    username       String    @unique
    displayName    String
    passwordHash   String?   // bcrypt hash (nullable during transition, seeded for existing)
    role           String    // "ADMIN" | "TEAM_LEADER" | "CALLER"
    twoFactorSecret String?  // Base32 secret for Admin 2FA (TOTP)
    twoFactorEnabled Boolean @default(false)
    teamId         String?
    team           Team?     @relation(fields: [teamId], references: [id])
    // ... relations
  }

  model Team {
    id        String   @id @default(cuid())
    name      String   @unique
    leaderId  String?
    members   User[]
    createdAt DateTime @default(now())
  }
  ```

### 2. Implementation Steps
1. **Password Authentication (`S4`):**
   * Install `bcryptjs` and `@types/bcryptjs`.
   * Update `src/app/api/auth/login/route.ts` to validate `password` against `passwordHash`.
   * Seed existing default users (`admin`, `piyush`, `alice`, `bob`) with secure default passwords (`Admin@123`, `Caller@123`).
2. **Two-Factor Authentication for Admins (`S5`):**
   * Implement TOTP generator/verifier using `otplib` or lightweight HMAC-SHA1.
   * If user has `role === 'ADMIN'` and `twoFactorEnabled === true`, require 6-digit TOTP code before granting session.
3. **Role-Based Access Control (`S11, S12, R9`):**
   * Update `src/lib/auth.ts` helper functions:
     * `requireRole(['ADMIN', 'TEAM_LEADER'])`
     * `requireAdmin()`
     * `requireCaller()`
   * Restrict `/api/admin/leads/export` to Admins & Team Leaders.
   * **Block Callers from downloading reports/leads:** Disable and remove `/api/leads/mine/export` or lock it behind Team Leader role.
4. **Session Timeout & Inactivity Auto-Logout (`S7`):**
   * Configure cookie `maxAge` to expire after 8 hours of inactivity.
   * Add client-side inactivity listener (30 min of no mouse/keyboard activity auto-clears session cookie and redirects to `/login`).

---

## Phase 2: Intelligent Bulk Lead Import Engine (D1 – D12)

### 1. Database Schema Updates
```prisma
model Lead {
  // ... existing fields
  city          String?
  sourceList    String?   // Tag source list (e.g., "FB Ads Oct", "99acres")
  importBatchId String?   // Unique batch ID per upload
  extraFields   String?   // JSON string storing arbitrary unmapped columns
  
  @@index([city])
  @@index([sourceList])
}

model ColumnMappingProfile {
  id          String   @id @default(cuid())
  sourceName  String   @unique // e.g., "MagicBricks", "Housing.com"
  mappingJson String   // JSON dictionary: { "Customer Name": "name", "Mobile No": "contact" }
  createdAt   DateTime @default(now())
}
```

### 2. Implementation Steps
1. **Phone Normalization & Splitter (`D7`):**
   * Create `src/lib/phone-cleaner.ts`:
     * Strip non-digit characters (spaces, hyphens, brackets, leading `+91` or `0`).
     * Detect cells with multiple numbers (e.g. `9820011111 / 9820022222` or `9820011111, 9820022222`).
     * Split into individual valid leads or primary/secondary contact.
     * Validate against standard 10-digit Indian mobile regex (`^[6-9]\d{9}$`).
2. **Phone As Only Mandatory Field (`D4`):**
   * Update validation in `import/route.ts` and `preview/route.ts`:
     * If `name` is blank, default to `"Unknown Lead"` or `"Lead #<phone>"`.
     * Reject row only if valid phone number cannot be extracted.
3. **Column Mapping Screen (`D2, D3, D5, D6`):**
   * Enhance `UploadClient.tsx`:
     * **Step 1:** Upload file (CSV/XLSX).
     * **Step 2 (Mapping Screen):** Auto-detect columns using string similarity & data patterns. Let user inspect and select target field for each source column.
     * **Step 3 (Extra Fields):** Any unmapped columns are checked to be saved inside `extraFields` JSON instead of being dropped.
     * **Step 4 (Save Template):** Allow saving mapping configuration as a reusable profile (`D6`).
4. **Interactive Import Preview (`D8, D9, D12`):**
   * Preview table highlights:
     * Valid rows (Green)
     * Duplicate rows (Yellow — option to skip or overwrite)
     * Invalid phones (Red — inline input to fix typo on the fly)
   * Auto-tag all imported leads with `sourceList` and upload timestamp (`D12`).
5. **Manual Customer-Entry Form (`D10`):**
   * Add a "➕ Add Single Lead" button on `/admin/leads` and `/dashboard`.
   * Form supports: Name, Phone (with validation), City, Source, and dynamic Key-Value extra fields.

---

## Phase 3: Reports, Metrics & History Timeline (R1 – R10)

### 1. Database Schema Updates
```prisma
model LeadStatusHistory {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  oldStatus String
  newStatus String
  note      String?
  createdAt DateTime @default(now())

  @@index([leadId])
  @@index([createdAt])
}

model CampaignCriteria {
  id          String   @id @default(cuid())
  name        String   @unique
  wonStatuses String   // JSON array: ["CONVERTED", "WON"]
  lostStatuses String  // JSON array: ["LOST", "NOT_INTERESTED"]
  createdAt   DateTime @default(now())
}
```

### 2. Implementation Steps
1. **Status Unification & Mapping (`R1, R2`):**
   * Define standard funnel categories:
     * **NEW:** Fresh uncontacted leads.
     * **IN_PROGRESS:** Active calls, follow-ups scheduled (`HOT`, `WARM`).
     * **WON:** Closed/converted customers (`CONVERTED`, `WON`).
     * **LOST:** Disqualified or rejected leads (`NOT_INTERESTED`, `LOST`).
   * Allow Admin to configure which custom tags map to Won and Lost (`R2`).
2. **Win Rate Dashboard & Formula (`R3, R4`):**
   * In `KpiTiles.tsx`, add dedicated cards:
     * **Total Leads**
     * **In Progress**
     * **Won Leads**
     * **Lost Leads**
     * **Win Rate Card:** Calculates $\frac{\text{Won}}{\text{Won} + \text{Lost}} \times 100\%$.
     * Clearly display formula badge: `Formula: Won ÷ (Won + Lost)`.
3. **Advanced Filtering (`R5`):**
   * Add interactive filter bars for:
     * Date Range (Presets: Today, This Week, This Month, Custom Date Range)
     * Caller / Agent
     * Team
     * Source List
     * City
4. **Historical Snapshots & Past Date Reopen (`R6`):**
   * Allow querying historical funnel data by passing `asOfDate` to calculate metrics as they stood on any past date using `LeadStatusHistory`.
5. **Excel (.xlsx) Downloads & Audit Logging (`R7, R10`):**
   * Replace plain CSV export with formatted multi-sheet Excel workbook using `xlsx`:
     * Tab 1: Summary KPI Metrics & Win Rate.
     * Tab 2: Filtered Lead Data.
   * Log every report export to `ActivityLog` with `{ action: "REPORT_DOWNLOADED", fileType: "XLSX", filters, recordCount, userId, ip }`.
6. **Lead Journey Timeline (`R8`):**
   * Build an interactive visual timeline drawer for every lead:
     * Shows creation, call logs with audio/notes, follow-up changes, and status transitions chronologically with timestamps and caller badge.

---

## Phase 4: Data Governance & Compliance (S3, S13)

### 1. Field-Level Encryption (`S3`):**
* Implement AES-256-GCM encryption in `src/lib/crypto.ts` with a dedicated `ENCRYPTION_KEY` secret.
* Encrypt phone and email at the application layer before writing to SQLite/Turso.
* Maintain a deterministic search hash (HMAC-SHA256) so duplicate lookups and exact searches remain $O(1)$ without decrypting the entire database.

### 2. GDPR/DPDP Permanent Deletion (`S13`):**
* Add "Erase Customer Data" action in lead detail view.
* Completely deletes lead, call recordings, follow-ups, and anonomyzes user activity references.

---

## 📅 Recommended Next Step

Start with **Phase 1: Security, Roles & Authentication**:
1. Implement password hashing & seed secure default credentials.
2. Upgrade User model to support `ADMIN`, `TEAM_LEADER`, and `CALLER`.
3. Lock down export APIs so Callers cannot download raw customer phone lists.
