# Firebase Realtime Database rules (recommended)

Paste these rules into your Firebase Console → Realtime Database → Rules.
They implement multi-tenant isolation by keeping a `shops/{shopCode}.ownerUid` mapping and allowing public clients to only CREATE new orders (status === 'new') while only the shop owner may READ or modify them.

```json
{
  "rules": {
    "shops": {
      "$shopCode": {
        // shop metadata readable/writable only by owner
        ".read": "auth != null && root.child('shops').child($shopCode).child('ownerUid').val() === auth.uid",
        ".write": "auth != null && root.child('shops').child($shopCode).child('ownerUid').val() === auth.uid"
      }
    },
    "customer_orders": {
      "$shopCode": {
        "$orderId": {
          // Anyone may CREATE a new order (when it does not exist).
          // Only the shop owner (authenticated) may read or modify orders.
          ".read": "auth != null && root.child('shops').child($shopCode).child('ownerUid').val() === auth.uid",
          ".write": "(
              !data.exists() && newData.exists()
              && newData.child('status').val() === 'new'
              && newData.child('time').isNumber()
            )
            || (auth != null && root.child('shops').child($shopCode).child('ownerUid').val() === auth.uid)"
        }
      }
    },
    ".read": false,
    ".write": false
  }
}
```

Notes:
- Ensure your app writes `shops/{shopCode}/ownerUid` when the owner signs in (the code in `app.js` already attempts to do this on Google sign-in).
- For additional protection, validate order payloads server-side using Cloud Functions (recommended).
- Move `firebaseConfig` to deployment environment variables where possible; client config is not secret, but rules are the true gatekeeper.
