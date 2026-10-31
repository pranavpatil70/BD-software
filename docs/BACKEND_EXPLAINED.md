# 🍳 Guide Part 2: The Backend Explained
### (The Secret Kitchen, Waiters & Security Guard Dogs)

Now let's step behind the swinging doors of the restaurant into **The Backend**!

If the Frontend is the pretty dining room where customers sit and look at the menu, the **Backend** is the **kitchen where the master chefs cook**, plus the **waiters who carry trays**, and the **bouncer standing at the front door**!

You cannot see the backend with your eyes on screen, but without it, tapping a button would do absolutely nothing!

In this project, the backend is built with **Next.js 16 API Routes (Route Handlers)** and **TypeScript**.

---

## 💂 1. The Bouncers at the Door (Authentication & Security)

Imagine a club with a VIP room for the Boss (Admin) and a game room for the Players (Callers). You can't just let any stranger wander in!

### 🕵️ The ID Card Inspector (`src/lib/auth.ts`)
Inside [`src/lib/auth.ts`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/lib/auth.ts), there are 5 loyal security guards:

1. **`getSession()`**: Checks if your web browser is wearing a digital wristband (called a cookie). If yes, it looks up your name in the database.
2. **`requireAuth()`**: If you don't have a wristband, it grabs you by the collar and redirects you to the `/login` screen!
3. **`requireAdmin()`**: If a regular caller tries to sneak into the Boss's Secret Control Room (`/admin`), this guard blocks them and kicks them back to their own dashboard.
4. **`requireUser()`**: If the Boss tries to open a caller's screen, it redirects them to the Admin command room.
5. **`assertOwnsLead(leadId, userId)`**: **The Anti-Cheating Rule!** If Alice tries to edit or call Bob's lead, the guard shouts *"Hey! That lead belongs to Bob, you cannot touch it!"* and throws a `403 Forbidden` error!

### 🚪 The Route Guard (`src/proxy.ts`)
* **What it does**: Before a web page even loads, this file acts like a turnstile at the subway. If you try to visit `/admin` or `/dashboard` without being logged in, it redirects you straight to the login screen before any secret information leaks out!

---

## 🍽️ 2. The Waiters (API Route Handlers)

Whenever you tap a button on your screen, a "Waiter" (called an **HTTP Request**) runs from your screen to the server with a message, and comes back with a tray of fresh data!

Here are the most important Waiters located inside [`src/app/api/`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/app/api):

```
 Your Phone Screen               API Waiter                   Database Kitchen
     (Frontend)                   (Backend)                      (Prisma DB)
         │                           │                                │
         │  "Here is a new note!"    │                                │
         ├──────────────────────────►│  Checks if note is valid...    │
         │   PATCH /api/leads/123    │  Calls prisma.lead.update()... │
         │                           ├───────────────────────────────►│
         │                           │                                │
         │  "Saved successfully!"    │◄───────────────────────────────┤
         │◄──────────────────────────┤   "Database updated!"          │
         │                           │                                │
```

---

### 📞 1. The Call Logger (`src/app/api/calls/route.ts`)
* **What it does**: When you tap the phone button to call someone, this waiter:
  1. Creates a new record in the `Call` table with the exact time to the second.
  2. Bumps the lead's `callCount` up by 1 (e.g., from 0 calls to 1 call).
  3. Writes in the `ActivityLog`: *"Alice called Toy Kingdom at 4:02 PM."*

### ✏️ 2. The Status & Notes Updater (`src/app/api/leads/[id]/route.ts`)
* **What it does**: Handles changes when a caller changes a status from "NEW" to "HOT" or types what the lead wanted.
* **The Bouncer inside (`Zod`)**: It uses a library called **Zod** (`z.enum(['NEW', 'HOT', 'WARM', ...])`). If someone tries to send a goofy status like `"SUPER_DUPER_HOT"`, Zod catches it immediately and says: *"Nope! Not an allowed status!"*

### 📥 3. The Spreadsheet Previewer (`src/app/api/admin/leads/preview/route.ts`)
* **What it does**: When the admin picks an Excel file, this waiter doesn't save anything yet. It just opens the file using the `xlsx` library, checks every row, and sends back a preview list:
  * Row 1: Valid ✅
  * Row 2: Phone number missing ❌
  * Row 3: Valid ✅
* This lets the boss verify everything is clean before saving!

### 💾 4. The Bulk Lead Importer (`src/app/api/admin/leads/import/route.ts`)
* **What it does**: When the admin clicks **Import**, this waiter creates all 500 leads at the same time in one single lightning-fast batch, links them to the selected caller, and logs the upload.

### 📡 5. The Live Feed Provider (`src/app/api/admin/activity/route.ts`)
* **What it does**: Powers the live spy ticker. The admin screen asks every few seconds: *"Give me the last 15 actions!"* and this waiter returns a neat list of the most recent calls and updates.

---

## 🧰 3. The Utility Belt (Helper Tools)

Inside [`src/lib/`](file:///c:/Users/ASUS/Documents/Callopss/partiklatthi64/src/lib), there are special gadget tools:

### 📱 1. The Phone Number Surgeon (`src/lib/phone.ts`)
People type phone numbers in all kinds of crazy ways:
* `9876543210` (no country code)
* `+91 98765-43210` (with dashes and spaces)
* `0091 9876543210` (starting with double zero)

The **Phone Surgeon** strips all brackets, spaces, and dashes, adds the default country code (like `+91`), and creates two clean versions:
1. `e164`: `+919876543210` (clean for computers to dial).
2. `display`: `+91 98765 43210` (pretty and easy for humans to read).

### 🛑 2. The Speed Limit Sign (`src/lib/rate-limit.ts`)
* **What it does**: If someone gets super excited and clicks the "Save" button 50 times in 2 seconds, or if an evil robot tries to guess passwords, this tool slows them down and says: *"Whoa, slow down! Wait a few seconds before trying again."*

### 🧮 3. The Math Genius (`src/lib/analytics.ts`)
* **What it does**: Does all the complex arithmetic for the boss:
  * Computes conversion percentage: $\frac{\text{Converted Leads}}{\text{Total Leads}} \times 100\%$
  * Calculates how many calls were made on Monday vs Tuesday.
  * Groups leads into funnel stages (New ➔ Hot ➔ Converted).

---

## 🧩 Summary of Backend Helpers

| File | What It Does | Who It Protects or Helps |
| :--- | :--- | :--- |
| **`auth.ts`** | Checks IDs, permissions, and stops cheating. | Keeps the app safe from unauthorized visitors. |
| **`phone.ts`** | Fixes messy phone numbers and adds country codes. | Helps callers dial without getting error tones. |
| **`leads/[id]/route.ts`**| Updates lead status and notes with Zod checks. | Saves caller notes instantly. |
| **`analytics.ts`** | Calculates stats, averages, and charts data. | Gives the boss accurate business reports. |
| **`rate-limit.ts`** | Prevents button-mashing and spam. | Keeps the server from crashing. |

👉 **Now let's see where all this precious data is kept! Open [DATABASE_EXPLAINED.md](./DATABASE_EXPLAINED.md)!**
