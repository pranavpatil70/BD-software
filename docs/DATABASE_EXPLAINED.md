# 🗄️ Guide Part 3: The Database Explained
### (The Giant Steel Safe & The Magic Notebook)

Welcome to the **Database**! 

Imagine you have a giant, fireproof steel safe in your clubhouse. Inside that safe are neat notebooks with dividers. Whenever someone joins the club, makes a phone call, or schedules a meeting, a robot writes it down in ink with a permanent quill. 

Even if you turn off your computer, unplug the power, or go to sleep, everything in the safe stays exactly where it was!

In this project, our steel safe is powered by **SQLite** (when running on your computer) and **Turso LibSQL** (when running on the cloud), managed by a super-smart tool called **Prisma**.

---

## 🧙‍♂️ 1. What is Prisma? (The Magic Translator)

Computers usually store information using a complex, ancient computer language called SQL (Structured Query Language):
```sql
-- What raw database code looks like:
SELECT * FROM "Lead" WHERE "assignedToId" = 'abc' AND "status" = 'HOT';
```

Writing raw SQL is hard and easy to mess up. **Prisma** acts like a magical translator. It lets us write clean TypeScript code:
```typescript
// What Prisma code looks like:
await prisma.lead.findMany({
  where: { assignedToId: 'abc', status: 'HOT' }
})
```
Prisma reads the blueprint file at [`prisma/schema.prisma`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/prisma/schema.prisma) and creates custom TypeScript tools automatically!

---

## 🗃️ 2. The 7 Notebooks Inside the Safe (The Database Models)

Here are the 7 main tables defined in [`prisma/schema.prisma`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/prisma/schema.prisma):

```
                       ┌────────────────────────┐
                       │       User (Team)      │
                       │ id, username, role...  │
                       └───────────┬────────────┘
                                   │
                                   │ 1 User has Many Leads
                                   ▼
                       ┌────────────────────────┐
                       │      Lead (Contact)    │
                       │ id, name, contact...   │
                       └───┬────────┬───────┬───┘
                           │        │       │
       ┌───────────────────┘        │       └────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  Call (Log)  │             │ FollowUp (4) │             │Meeting (Appt)│
│ calledAt...  │             │ slot, note...│             │type, date... │
└──────────────┘             └──────────────┘             └──────────────┘
```

---

### 1. The `User` Notebook (Team Members)
* **What it stores**: Everyone allowed to log in.
* **Fields**:
  * `id`: A unique secret code for each person (e.g., `cuid()`).
  * `username`: Their login handle (e.g., `"alice"`, `"bob"`, `"admin"`).
  * `displayName`: Their real name on badges (e.g., `"Alice Johnson"`).
  * `role`: Either `"ADMIN"` (the boss) or `"USER"` (caller).
  * `active`: `true` or `false` (if someone leaves the club, this turns off).

---

### 2. The `Lead` Notebook (People to Call)
* **What it stores**: Customers or store owners you want to sell toys to!
* **Fields**:
  * `name`: The shop or person's name (e.g., `"Awesome Comics Ltd"`).
  * `contact`: Their phone number or email.
  * `hasWebsite`: `true` if they have an online shop.
  * `status`: Where they are in the friendship ladder (`NEW`, `HOT`, `WARM`, `COLD`, `NOT_INTERESTED`, `CONVERTED`, or `NOT_RECEIVED`).
  * `firstInterest`: What they told you they want (e.g., *"Wants 20 blue bikes"*).
  * `callCount`: How many times our team has dialed them.
  * `lastCalledAt`: The exact date & minute of the most recent phone call.
  * `assignedToId`: Points to the specific `User` whose job it is to call this person!

---

### 3. The `Call` Notebook (Call Receipts)
* **What it stores**: A permanent receipt every time someone dials.
* **Fields**:
  * `leadId`: Who was called.
  * `userId`: Which team member made the call.
  * `calledAt`: The exact timestamp.
  * `notes`: What happened on the call.

---

### 4. The `FollowUp` Notebook (Future Reminders)
* **What it stores**: Up to 4 calendar reminder slots for each lead!
* **Fields**:
  * `leadId`: The lead being reminded.
  * `slot`: A number from `1` to `4` (Slot 1, Slot 2, Slot 3, Slot 4).
  * `scheduledAt`: When to call them back (e.g., *"Friday at 2:00 PM"*).
  * `note`: Why you're calling back (e.g., *"Ask if their manager approved the budget"*).
  * `completed`: Checked off (`true`) or still pending (`false`).
* **The Cool Rule**: `@@unique([leadId, slot])` ensures you can never accidentally create two Slot 1s for the same person!

---

### 5. The `Meeting` Notebook (Important Appointments)
* **What it stores**: Big official meetings.
* **Fields**:
  * `type`: Either `"ONLINE"` (Zoom / Google Meet) or `"OFFLINE"` (Coffee shop / office).
  * `scheduledAt`: Date and time of the meeting.
  * `note`: Agenda for the meeting.

---

### 6. The `ActivityLog` Notebook (The Airplane Black Box)
* **What it stores**: A diary entry for every single event that happens in the company!
* **Fields**:
  * `action`: What happened? (`CALL`, `STATUS_CHANGE`, `FOLLOWUP_SET`, `LEAD_UPLOADED`, `LEAD_ASSIGNED`).
  * `metadata`: Extra details stored in JSON format (e.g., `{"from": "NEW", "to": "HOT"}`).
  * `createdAt`: Time the action took place.

---

### 7. `Notification` & `CsvAssignment`
* **`Notification`**: Little alerts created when leads are assigned (e.g., *"Hey Alice, you just got 25 new leads from the boss!"*).
* **`CsvAssignment`**: Keeps track of which uploaded Excel file went to which caller.

---

## 🔗 3. Relationships: How Tables Hold Hands

In a database, tables don't live on isolated islands; they are connected like Lego blocks!

### 👨‍👧 One-to-Many (Parent and Children)
* **One User has Many Leads**: Alice (one person) can have 50 different leads assigned to her backpack.
* **One Lead has Many Calls**: You might call *"Super Toys"* on Monday, again on Wednesday, and again on Friday. That is 3 calls linked to 1 lead!

### 🗑️ Cascade Delete (Cleaning Up the Toy Box)
Notice this line in the code:
```prisma
lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
```
* **What this means**: If you delete a lead because it was a fake number, `onDelete: Cascade` automatically deletes all their call records, follow-ups, and meetings too! 
* Without this, ghost records would sit around cluttering the safe forever.

---

## 🌱 4. Seed Data: Starting the Game with Default Characters

When you first build this app, the safe is totally empty. How do we test it?

Inside [`prisma/seed.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/prisma/seed.ts), there is a **Seeding Script**. When you run:
```bash
npm run db:seed
```
It instantly injects 3 default starter characters:
1. 👑 **`admin`**: The boss with full power.
2. 🦸 **`alice`**: A friendly business developer caller.
3. 🦹 **`bob`**: Another business developer caller.

Now anyone can log in right away and start testing without setting up accounts manually!

---

👉 **Now for the grand finale! Read [HOW_EVERYTHING_CONNECTS.md](./HOW_EVERYTHING_CONNECTS.md) to see the entire amusement park in action!**
