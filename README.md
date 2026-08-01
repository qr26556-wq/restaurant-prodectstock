# RESTPOS — Restaurant POS System (Core build)

A responsive restaurant billing + kitchen system: Firebase Auth, Firestore,
vanilla JS, installable as a PWA. This is **Phase 1** of the full spec —
see [What's next](#whats-next) for what's intentionally not built yet.

## What's included

| Page | Who | What it does |
|---|---|---|
| `login.html` | everyone | Email/password sign-in via Firebase Auth |
| `dashboard.html` | admin | Today's sales, orders, low stock, 7-day chart, recent orders |
| `pos.html` | admin + cashier | Billing screen: categories, cart, dine-in/takeaway/delivery, tables, discount/tax, cash/card/online, hold order, receipt |
| `kitchen.html` | admin + cashier | Live KOT board: New → Preparing → Ready → Completed |
| `products.html` | admin | Product CRUD, stock, SKU, categories, low-stock flag |
| `orders.html` | admin + cashier | Order list, filters, detail view, cancel, status change, print receipt (58mm/80mm) |

Data lives in Firestore, in real time, under: `users`, `categories`,
`products`, `tables`, `orders`, `settings`.

## 1. Set up Firebase

1. In the [Firebase Console](https://console.firebase.google.com), open your
   project → **Build → Authentication → Sign-in method** → enable **Email/Password**.
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

## 2. Create your first admin account

The app never lets a cashier promote themselves, so the very first admin has
to be created by hand, once:

1. **Authentication → Users → Add user** — create the admin's email/password.
2. Copy the new user's **UID**.
3. **Firestore → Start collection** → collection ID `users` → document ID =
   that UID → add fields:
   ```
   name: "Your Name"        (string)
   email: "you@restaurant.com"  (string)
   role: "admin"             (string)
   active: true              (boolean)
   ```
4. Sign in on `login.html` with the **Admin** tab.

After that, Staff Management (Phase 2, see below) will let admins create
cashier logins from the UI instead of the console.

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
