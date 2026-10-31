# Log 15: Phone Number Standardizer & Validator (D7)

**Date**: 2026-10-28  
**Task Ref**: D7 (Phone Number Standardization & Duplicate Detection)  
**Status**: Completed & Verified  

---

## 1. Problem Overview
Prior to this implementation:
1. **Broken Deduplication**: If the database had `+919876543210`, and a new CSV uploaded `9876543210` or `098765 43210`, exact string matching failed to detect the collision, resulting in duplicate leads being imported and assigned.
2. **Garbage Contact Imports**: Numbers with fewer than 10 digits (`12345`), non-digit strings (`N/A`, `nil`), or all-repetitive digits (`0000000000`) were imported as active leads.
3. **Broken Dialers & WhatsApp Links**: WhatsApp API URLs failed when numbers contained `+` in the path or contained unescaped spaces or hyphens.

---

## 2. Solution Implemented

### 1. New Phone Engine: `src/lib/phone.ts`
- **`cleanPhoneNumber(raw: unknown)`**:
  - Strips non-digit formatting (spaces, dashes, parentheses).
  - Handles leading prefixes: `+91`, `91`, `091`, `0091`, and single leading `0`.
  - Rejects repetitive garbage (`0000000000`, `1111111111`) and short numbers (<10 digits).
  - Standardizes valid 10-digit Indian numbers to E.164 canonical format (`+91XXXXXXXXXX`).
  - Returns `cleaned`, `national` (10-digit), `formatted` (`+91 XXXXX XXXXX`), `isValid`, and error `reason`.
- **`toWhatsAppUrl(phone, message)`**:
  - Automatically formats the recipient number to pure digits without `+` as required by official `https://wa.me/` specifications.
- **`toTelUrl(phone)`**:
  - Returns standard `tel:+91XXXXXXXXXX` dialer link.
- **`parseContact(contact)`**:
  - Categorizes contact into `phone`, `email`, or `unknown` for the dialer popup.

### 2. Integration into CSV Preview: `src/app/api/admin/leads/preview/route.ts`
- Normalizes all incoming contact numbers using `cleanPhoneNumber`.
- Queries the database using both canonical (`+91XXXXXXXXXX`) and national (`XXXXXXXXXX`) representations to catch pre-existing duplicates regardless of stored format.
- Flags invalid numbers with clear error messages (`Phone number too short`, `Invalid repetitive number`) before import.

### 3. Integration into Bulk Import: `src/app/api/admin/leads/import/route.ts`
- Validates every row; skips invalid or garbage phone numbers.
- Stores phone numbers strictly in standardized `+91XXXXXXXXXX` format.
- Deduplicates against both the database and within the batch itself.

### 4. Integration into WhatsApp Dialer: `src/components/ui/WhatsAppButton.tsx`
- Switched from raw string manipulation to `toWhatsAppUrl` from `@/lib/phone`.

---

## 3. Live Test Verification

| Test Case | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Leading zero format** | `09988776655` | Stored as `+919988776655` | Stored as `+919988776655` | ✅ Passed |
| **Hyphenated format** | `+91-91234-56789` | Stored as `+919123456789` | Stored as `+919123456789` | ✅ Passed |
| **Spaced duplicate in batch** | `+91 99887 76655` | Detected as duplicate of `09988776655` | Skipped (Count: 0) | ✅ Passed |
| **Garbage length** | `12345` | Flagged as invalid | Skipped (<10 digits) | ✅ Passed |
| **Repetitive number** | `0000000000` | Flagged as invalid | Skipped (Repetitive) | ✅ Passed |
| **Cross-format DB duplicate** | `9988776655` (10 digits) | Matches existing `+919988776655` in DB | Count: 0 imported | ✅ Passed |
| **Production Build** | `npm run build` | Exit Code 0 | 27 routes compiled clean | ✅ Passed |

---

## 4. Conclusion
Feature `D7` is complete, verified through automated tests, and operational without breaking any existing functionality.
