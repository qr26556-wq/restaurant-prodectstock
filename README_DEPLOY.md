# Deployment & Firebase setup (quick checklist)

This file contains exact copy/paste steps to deploy the customer-order MVP on the `feature/customer-orders` branch.

IMPORTANT: Do not share private keys or service-account JSONs in chat. Use the Firebase Console and your hosting provider's environment variable UI to set secrets.

1) Clone & checkout the branch

```bash
git clone https://github.com/qr26556-wq/restaurant-prodectstock.git
cd restaurant-prodectstock
git fetch origin
git checkout feature/customer-orders
```

2) Local test (static, no Firebase required)

Start a simple static server and test both POS and the public order page locally:

```bash
# from repo root
python -m http.server 5000
# or
npx http-server -p 5000
```

- Open POS: http://localhost:5000/
- Open Customer page: http://localhost:5000/public/order.html?shop=local_shop_default

Place an order on the customer page and open the Incoming Orders bell (🔔) in the POS — localStorage is used so this works without Firebase.

3) Prepare Firebase project & config

- In Firebase Console -> Project settings -> "Your apps" -> SDK configuration, copy the config JSON. It looks like:

```json
{
  "apiKey":"...",
  "authDomain":"PROJECT.firebaseapp.com",
  "databaseURL":"https://PROJECT.firebaseio.com",
  "projectId":"PROJECT_ID",
  "storageBucket":"PROJECT.appspot.com",
  "messagingSenderId":"...",
  "appId":"..."
}
```

4) Add `FIREBASE_CONFIG` to your hosting environment (Vercel recommended)

- Vercel: Project → Settings → Environment Variables
  - Name: `FIREBASE_CONFIG`
  - Value: paste the JSON above as a single line (compact). Example value:

  `{ "apiKey":"...","authDomain":"...","databaseURL":"https://PROJECT.firebaseio.com","projectId":"PROJECT_ID","storageBucket":"...","messagingSenderId":"...","appId":"..." }`

- If your host cannot inject env into the client at runtime, you can temporarily insert this in the HTML for testing (not recommended for production):

  ```html
  <script>window.firebaseConfig = { /* paste config */ };</script>
  ```

5) Apply Realtime Database rules (critical)

- In Firebase Console → Realtime Database → Rules, replace rules with the contents of `FIREBASE_RULES.md` in this repo.
- Or use the CLI:

```bash
# create database.rules.json with contents from FIREBASE_RULES.md
firebase use --add            # select your project
firebase deploy --only database:rules --project YOUR_PROJECT_ID
```

These rules ensure multi-tenant isolation: public clients can CREATE new orders under `customer_orders/{shopCode}`, but only the shop owner (written at `shops/{shopCode}.ownerUid`) can READ or modify them.

6) Deploy Cloud Functions (optional but recommended)

Cloud Function in `functions/index.js` validates new orders and writes a small notification under `shops/{shop}/notifications`.

```bash
cd functions
npm install
# ensure firebase CLI is authenticated and set to your project
firebase deploy --only functions --project YOUR_PROJECT_ID
```

Notes:
- Functions require Firebase CLI and permission to deploy functions. You may need to enable billing for certain features.

7) Host the static site

- If using Vercel: point the project to this repository and deploy the `feature/customer-orders` branch as a preview or production (set build & output if needed). Ensure `FIREBASE_CONFIG` env var is set in Vercel Settings.
- If using a simple static host (S3, Netlify, GitHub Pages), upload the site and make sure the `window.firebaseConfig` is available to the client (see step 4).

8) Owner sign-in to register `ownerUid`

- Open POS (deployed URL), click "Sign in" and sign in with Google. The app will write `shops/{shopCode}.ownerUid` so DB rules can allow the owner to read orders.

9) Test live flow

- Customer places order: `public/order.html?shop=SHOPCODE`
- Cloud Function validates; order appears under `customer_orders/SHOPCODE/ORDERID`.
- POS (owner) sees incoming order via the bell; owner can Accept / Send to kitchen (UI improvements available in future PRs).

10) Useful CLI commands

```bash
# install firebase tools
npm i -g firebase-tools
firebase login
firebase use --add
# deploy DB rules
firebase deploy --only database:rules --project YOUR_PROJECT_ID
# deploy functions
cd functions
npm install
firebase deploy --only functions --project YOUR_PROJECT_ID
```

11) Security reminders

- Do not paste service-account JSON or tokens into chat. Use Firebase Console and Vercel UI for configuration.
- The client `apiKey` is not secret; the Realtime DB rules are what enforce security.
- If you want me to deploy functions or apply rules for you, invite an admin or provide a teammate who can run the commands (I will supply the exact commands). I cannot accept secrets in chat.

---

If you want, I can also:
- Add Accept / In-progress / Ready buttons on the POS that update `customer_orders/{shop}/{orderId}/status` (owner-only). I will implement that next if you say "proceed status UI".
- Help you set up Vercel environment variables step-by-step while you run the commands locally.

