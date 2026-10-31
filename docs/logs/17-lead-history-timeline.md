# 📜 Technical Log 17: Complete Lead Activity Timeline (Feature R2)

---

## 1. Requirement & Overview
- **Feature Code:** `R2`
- **Specification:** Complete unified chronological lead activity timeline showing all calls, outcomes, notes, follow-ups, meetings, and status changes for each lead, with exact timestamps and caller badges.
- **Security Rule Enforced:**
  - **Caller Data Isolation:** Callers can ONLY access the timeline of their own assigned leads. If a caller requests the timeline of a lead assigned to another caller (or unassigned), the backend rejects it with `403 Forbidden`.
  - **Admin Global Oversight:** Admins can view the complete timeline of ANY lead across all callers.

---

## 2. Changes Implemented

### Backend Endpoint
- Created [`src/app/api/leads/[id]/timeline/route.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api/leads/[id]/timeline/route.ts):
  - Authenticates request with `requireAuth(req)`.
  - Enforces `await assertOwnsLead(id, user.id)`. Caller intrusion attempts fail with `403 Forbidden`.
  - Queries `Lead`, `Call`, `FollowUp`, `Meeting`, and `ActivityLog` in a single scoped query.
  - Compiles events into a unified chronological array sorted descending by `timestamp`:
    - `CALL`: Call logged, call duration, notes, and caller displayName.
    - `MEETING`: Meeting scheduled, meeting type, outcome, notes, and caller displayName.
    - `FOLLOWUP`: Follow-up slot, scheduled date, completed status, notes.
    - `STATUS_CHANGE`: Old status → New status with caller attribution.
    - `WHATSAPP`: WhatsApp click audit timestamp.
    - `REASSIGNED`: Lead assignment history.
    - `CREATION`: Lead entry into the system (CSV import or manual entry).

### Frontend Drawer Component
- Created [`src/components/leads/LeadTimelineDrawer.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/components/leads/LeadTimelineDrawer.tsx):
  - Slide-out drawer with contact info, status pill, and assignee header.
  - KPI metric cards: Total Calls, Follow-ups, and Meetings.
  - Color-coded vertical timeline with icons:
    - 📞 Phone for Calls (with notes callout and caller badge).
    - 🤝 Calendar for Meetings (with type, outcome, notes, and caller badge).
    - ⏰ Clock for Follow-ups (with slot number, scheduled time, and notes).
    - 🔄 Refresh for Status Changes (from status → to status).
    - 💬 WhatsApp for WhatsApp clicks.
    - 📥 Plus for Lead Creation.

### UI Integration
- **Caller Dashboard:** [`src/app/dashboard/DashboardClient.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/dashboard/DashboardClient.tsx):
  - Added "Timeline" button in desktop table and mobile cards.
  - Rendered `<LeadTimelineDrawer>` with caller-scoped permissions.
- **Admin Leads Console:** [`src/app/admin/leads/LeadsClient.tsx`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/admin/leads/LeadsClient.tsx):
  - Added "Timeline" button and "View Timeline" menu action in desktop table and grid cards.
  - Rendered `<LeadTimelineDrawer>` with admin global oversight.

---

## 3. Security Penetration Test Verification

Live test executed via `test_timeline_security.js` on `http://localhost:3000`:

```
Alice lead ID: cmvryo1ca00f1vb6on9934cyh
Bob lead ID:   cmvryo18d00d5vb6oyrifg506

1. Alice -> Alice lead timeline: HTTP 200 OK (Allowed)
2. Alice -> Bob lead timeline (Intrusion): HTTP 403 Forbidden (Blocked)
3. Bob -> Alice lead timeline (Intrusion): HTTP 403 Forbidden (Blocked)
4. Admin -> Alice lead timeline: HTTP 200 OK (Allowed)
5. Admin -> Bob lead timeline: HTTP 200 OK (Allowed)
Total timeline events for lead: 7
Sample event: Type FOLLOWUP | Title: "Follow-up Slot 1 Completed"
```

---

## 4. Build & Production Verification
- `npm run build` compiled cleanly with Turbopack and zero TypeScript errors (exit code `0`).
- Route `/api/leads/[id]/timeline` rendered dynamically as `ƒ (Dynamic)`.

