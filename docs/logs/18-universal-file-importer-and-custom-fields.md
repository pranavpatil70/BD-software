# 📜 Technical Log 18: Universal File Importer & Dynamic Custom Fields (Feature D1 + Custom Fields)

---

## 1. Requirement & Overview
- **User Specification:**
  - Freedom to upload any file format: **CSV**, **Excel** (`.xlsx`, `.xls`), and **PDF**.
  - Complete freedom to import **any custom field** (e.g., `Location`, `City`, `Budget`, `Company`, `Industry`) without losing data.
  - Interactive visual column mapping so admins can match spreadsheet headers to Callopss fields and select which custom fields to import.
  - Strict scope control: only change the necessary files without touching unrelated code.
  - Strict caller isolation: callers only see custom fields for their own assigned leads; Admin sees all.

---

## 2. Changes Implemented

### Database Schema
- [`prisma/schema.prisma`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/prisma/schema.prisma):
  - Added `customFields String?` to model `Lead`:
    ```prisma
    model Lead {
      ...
      firstInterest String?
      customFields  String?   // JSON string of arbitrary custom attributes (e.g. location, budget)
      ...
    }
    ```
  - Executed `prisma db push` and `prisma generate` to update database and client.

### Backend Endpoints
- **Universal File Parser & Preview:** [`src/app/api/admin/leads/preview/route.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api/admin/leads/preview/route.ts)
  - Universal format support:
    - **CSV & Excel:** parsed via `xlsx`.
    - **PDF tables:** parsed via `pdfjs-dist` with y-coordinate line grouping and automatic delimiter detection (tabs, pipes, commas, or spaces).
  - Dynamic column discovery: collects all unique headers across rows.
  - Smart auto-mapping:
    - Auto-detects `Name`, `Contact`, `Website`, `First Interest`.
    - Automatically classifies all other columns (e.g., `Location`, `Budget`) as dynamic `customFields`.
  - Performs canonical phone validation (`+91XXXXXXXXXX`), file duplicate checks, and database collision checks.
- **Dynamic Importer:** [`src/app/api/admin/leads/import/route.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api/admin/leads/import/route.ts)
  - Updated Zod validation schema to accept `customFields: z.record(z.string(), z.any()).optional()`.
  - Serializes `customFields` to JSON and persists it directly into `Lead.customFields`.
- **Timeline Endpoint:** [`src/app/api/leads/[id]/timeline/route.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api/leads/[id]/timeline/route.ts)
  - Returns `customFields` in the lead metadata payload under `assertOwnsLead` protection.

### Frontend UI Components
- **Column Mapping & Custom Fields Selector:** [`src/app/admin/upload/UploadClient.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/admin/upload/UploadClient.tsx)
  - Accepts `.xlsx,.xls,.csv,.pdf`.
  - **Step 2: Visual Column Mapping:**
    - Dropdowns to map Name (required), Contact (required), Website (optional), First Interest (optional).
    - **Dynamic Custom Fields Selector:** Interactive badge toggles for every extra column discovered in the file (`📍 Location`, `🏢 Company`, `💰 Budget`, etc.) with "Select All" / "Clear".
  - **Step 3: Preview Table:**
    - Displays row number, name, phone, website status, custom field chips, and validation state (`✓ Valid` vs `✗ Reason`).
    - Quick-filter tabs: `All`, `Valid Only`, `Errors Only`.
    - "Import X Valid Leads" button.
- **Drawer Displays:**
  - [`LeadTimelineDrawer.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/components/leads/LeadTimelineDrawer.tsx): Parses `lead.customFields` JSON and renders styled badges (e.g., `Location: Mumbai`, `Budget: 60000`).
  - [`LeadDetailDrawer.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/components/admin/LeadDetailDrawer.tsx): Displays a dedicated "Custom Fields" card.

---

## 3. Test & Verification Matrix

### Live End-to-End Test Execution
Executed `test_custom_fields_import.js`:

```text
--- Step 1: Admin Login ---
Admin logged in successfully.
Alice ID: cmvryo0h80002vb6onismkxpv

--- Step 2: Test Preview Endpoint with Custom Fields ---
Preview HTTP Status: 200
Detected Columns: [ 'Name', 'Phone', 'Website', 'Location', 'Budget', 'Company' ]
Detected Mapping: {
  name: 'Name',
  contact: 'Phone',
  website: 'Website',
  firstInterest: '',
  customFields: [ 'Location', 'Budget', 'Company' ]
}
Preview Rows Count: 2
First Row Custom Fields: {
  Location: 'Mumbai - Andheri',
  Budget: '60000',
  Company: 'Verma Technologies'
}

--- Step 3: Test Import Endpoint with Custom Fields ---
Import HTTP Status: 200
Imported count: 2

--- Step 4: Verify Alice Lead & Custom Fields in Timeline ---
Found lead in Alice dashboard: Kavita Verma (ID: cmvw2hmlk000ifoqgk5cgaxqm)
Timeline HTTP Status: 200
Timeline Lead customFields raw: {"Location":"Mumbai - Andheri","Budget":"60000","Company":"Verma Technologies"}
Parsed custom fields: {
  Location: 'Mumbai - Andheri',
  Budget: '60000',
  Company: 'Verma Technologies'
}

--- Step 5: Verify Strict Caller Isolation on Lead with Custom Fields ---
Bob accessing Alice lead (Intrusion Attempt): HTTP 403 Forbidden (Blocked)

--- Step 6: Verify Admin Global Access ---
Admin accessing lead: HTTP 200 OK (Allowed)
```

### PDF Table Parsing Test
```text
PDF Preview Status: 200
PDF Columns: [ 'Name', 'Phone', 'Website', 'Location', 'Budget' ]
PDF Mapping: {
  name: 'Name',
  contact: 'Phone',
  website: 'Website',
  firstInterest: '',
  customFields: [ 'Location', 'Budget' ]
}
PDF Row 0: {
  rowNumber: 2,
  name: 'Sunil Mehta',
  contact: '+919899887766',
  hasWebsite: false,
  firstInterest: null,
  customFields: { Location: 'Delhi NCR', Budget: '45000' },
  status: 'valid'
}
```

---

## 4. Production Build Verification
- `npm run build` compiled with 0 errors (`exit code 0`).
- TypeScript verification passed with 0 errors.
- Dev server active on `http://localhost:3000`.

