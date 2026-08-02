# RESTPOS — Restaurant POS System (Core build)

A responsive restaurant billing + kitchen system: Firebase Auth, Firestore,
vanilla JS, installable as a PWA. This is **Phase 1** of the full spec —
see [What's next](#whats-next) for what's intentionally not built yet.

## What's included

| Page | Who | What it does |
|---|---|---|
| `login.html` | everyone | Email/password sign-in via Firebase Auth |
| `dashboard.html` | admin + manager | Today's sales, orders, low stock, 7-day chart, recent orders (staff join-codes panel is admin-only) |
| `pos.html` | admin + manager + cashier | Billing screen: categories, cart, dine-in/takeaway/delivery, tables, discount/tax, cash/card/online, hold order, receipt |
| `kitchen.html` | admin + manager + cashier | Live KOT board: New → Preparing → Ready → Completed |
| `products.html` | admin + manager | Product CRUD, stock, SKU, categories, low-stock flag |
| `orders.html` | admin + manager + cashier | Order list, filters, detail view, cancel, status change, print receipt (58mm/80mm) |

Data lives in Firestore, in real time, under: `users`, `categories`,
`products`, `tables`, `orders`, `settings`.

## 0. Multi-tenant: every shop is fully isolated

This build supports **many restaurants on the same Firebase project**, with
zero data crossover. Each shop is its own `/restaurants/{restaurantId}`
document; its categories, products, tables, orders and settings all live in
subcollections underneath that one document. Staff of Restaurant A can never
read or write a single document belonging to Restaurant B — it's a
structurally separate branch of the database, enforced by `firestore.rules`,
not just hidden in the UI.

A brand-new shop owner never touches the Firebase Console at all:
**`login.html` → "Create your shop"** → enter a restaurant name → sign in
with their own Google account → they land on their own private Dashboard as
that shop's first Admin. From there they generate staff join codes (below)
for everyone else at their restaurant. One Google account can only ever
belong to one restaurant.

## 1. Set up Firebase

1. In the [Firebase Console](https://console.firebase.google.com), open your
   project → **Build → Authentication → Sign-in method** → enable **Email/Password**
   (this also turns on the "Forgot password" reset-email flow). If you want the
   **Continue with Google** button on the login page to work, enable **Google**
   as a sign-in provider too, and set a support email for it.
2. **Build → Firestore Database** → Create database (production mode is fine —
   the rules below lock it down).
3. **Project settings → General → Your apps** → copy the config object into
   `js/firebase-config.js` (replace the `YOUR_...` placeholders). These
   values are safe to be public; real protection is the rules file.
4. Deploy `firestore.rules`:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase init firestore   # point it at this project, keep the existing rules file
   firebase deploy --only firestore:rules
   ```
   Or simplest: paste the contents of `firestore.rules` into **Firestore →
   Rules** in the console and click Publish.

## 2. Create your first admin account (manual fallback)

Normally you don't need this — use **"Create your shop"** on the login page
instead (see section 0 above), which does all of this for you automatically.
Use this manual path only if you'd rather not use Google sign-in for the
very first account, or need to create it directly from the console:

The app never lets a cashier promote themselves, so the very first admin has
to be created by hand, once:

1. **Authentication → Users → Add user** — create the admin's email/password.
2. Copy the new user's **UID**.
3. **Firestore → Start collection** → collection ID `restaurants` → add a
   document (auto-ID is fine) with fields:
   ```
   name: "Your Restaurant Name"  (string)
   ownerUid: "<the UID from step 2>"  (string)
   ```
   Copy this new document's **ID** too — that's your `restaurantId`.
4. **Firestore → Start collection** → collection ID `users` → document ID =
   the admin's UID → add fields:
   ```
   name: "Your Name"             (string)
   email: "you@restaurant.com"   (string)
   role: "admin"                 (string)
   active: true                  (boolean)
   restaurantId: "<the restaurant doc ID from step 3>"  (string)
   ```
5. Sign in on `login.html` with the **Admin** tab.

Note: signing in with Google works the same way — it only grants access once
a `users/{uid}` profile exists for that account. Someone can tap "Continue
with Google" and authenticate, but without a matching profile they'll just
see "No staff profile is linked to this account yet." No one can grant
themselves access, admin or otherwise, just by signing up.

## 3. Roles

Three roles: **Admin** (everything, incl. generating staff codes), **Manager**
(Dashboard, POS, Kitchen, Products, Orders — everything except managing staff
codes/profiles), and **Cashier** (POS, Kitchen, Orders only).

## 4. Adding the rest of your staff — join codes

Once the first admin exists, everyone else can add themselves with their own
Google account — no console work per person:

1. Admin signs in → **Dashboard → Staff join codes** → pick a role
   (Admin / Manager / Cashier) → **Generate code**. A 6-character code appears.
2. Share that code with the staff member (WhatsApp, SMS, in person).
3. On their own phone, they open `login.html` → **"Join with a staff code"**
   → enter the code → **Continue with Google**, using their own account.
4. Their `users/{uid}` profile is created automatically with the role tied
   to that code, and the code is marked used so it can't be reused. They're
   dropped straight onto the Dashboard (admin/manager) or POS (cashier).

Each code works exactly once. Generate a new one per person. This entirely
replaces the manual "Authentication → Users" + "Firestore → users/{uid}"
steps above for every staff member *after* the first admin.

## 3. Try it out

Once signed in as admin, the Dashboard shows a **"Load sample data"** banner
if your catalog is empty — it seeds a handful of categories, products and
tables so you can run a full order through POS → Kitchen → Orders right away.

## 4. Deploy

Static site, no build step:

- **Netlify**: drag the project folder into Netlify, or connect the GitHub
  repo — publish directory is the project root.
- **GitHub**: `git init && git add . && git commit -m "init" && git push`.

Add your deployed domain (and `localhost` for testing) to **Authentication →
Settings → Authorized domains** in Firebase.

## Project structure

```
/
├── index.html          # routes to login/dashboard/pos based on auth+role
├── login.html
├── dashboard.html
├── pos.html
├── kitchen.html
├── products.html
├── orders.html
├── css/styles.css
├── js/
│   ├── firebase-config.js   # ← paste your config here
│   ├── common.js             # nav, toasts, guard(), formatting, icons
│   ├── db.js                 # all Firestore reads/writes
│   ├── login.js / dashboard.js / pos.js / kitchen.js / products.js / orders.js
├── assets/icons/
├── manifest.json
├── sw.js
└── firestore.rules
```

## What's next

Built for a later pass, per the original spec: **Customer management,
Inventory (stock-in/out/wastage/history), full Reports (daily/weekly/
monthly/yearly, cashier & category breakdowns, profit, export/print),
Expense management, Staff management UI (admin creates/edits/disables
cashiers), Settings page (logo/tax/printer/theme), Cloudinary product-image
upload, and richer notifications.** The data layer (`db.js`) and rules file
are already structured so those slot in without touching what's here —
categories/products/orders/tables all exist; the remaining pages are new
screens on top of the same collections plus a few new ones (`customers`,
`expenses`, `inventoryLog`).

## Notes

- Currency and tax % come from `settings/general` (defaults to ₹ and 5% until
  you seed data or add a Settings page).
- Stock decrements happen transactionally the moment an order is billed
  (POS "Complete order" or a resumed held order) — not when the kitchen
  marks it done — so two cashiers can't oversell the same last portion.
- Cancelling an order restores any stock it had committed and frees its table.
