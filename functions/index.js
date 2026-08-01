const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize the admin SDK
try {
  admin.initializeApp();
} catch (e) {
  // already initialized
}

// Basic validation & notification on new customer orders
exports.validateOrder = functions.database.ref('/customer_orders/{shop}/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.val();
    const ref = snap.ref;
    const shop = context.params.shop;

    // Basic schema checks
    if (!order || typeof order.time !== 'number' || order.status !== 'new' || !order.customer || !order.customer.name || !Array.isArray(order.lines) || order.lines.length === 0) {
      await ref.update({ status: 'rejected', rejectedReason: 'invalid_payload' });
      return null;
    }

    // Compute subtotal from lines (if prices provided)
    const calcSubtotal = order.lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
    if (order.subtotal != null && Math.abs(calcSubtotal - Number(order.subtotal)) > 0.01) {
      await ref.update({ status: 'rejected', rejectedReason: 'subtotal_mismatch' });
      return null;
    }

    // Anti-spam: check for recent orders from same phone within last 60s
    try {
      if (order.customer && order.customer.phone) {
        const since = Date.now() - 60 * 1000; // 1 minute
        const rootRef = admin.database().ref(`/customer_orders/${shop}`);
        const snapshot = await rootRef.orderByChild('time').startAt(since).once('value');
        let tooSoon = false;
        snapshot.forEach(child => {
          const o = child.val();
          if (o && o.customer && o.customer.phone === order.customer.phone) {
            tooSoon = true;
            return true; // break
          }
        });
        if (tooSoon) {
          await ref.update({ status: 'rejected', rejectedReason: 'rate_limit' });
          return null;
        }
      }
    } catch (e) {
      // continue even if check fails
      console.warn('Anti-spam check failed', e);
    }

    // Create a lightweight notification for the owner under shops/{shop}/notifications
    try {
      const notifRef = admin.database().ref(`shops/${shop}/notifications`).push();
      await notifRef.set({ orderId: order.id, time: Date.now(), type: 'new_order' });
    } catch (e) {
      console.warn('Could not write notification', e);
    }

    // Send FCM push notifications to registered device tokens (if present)
    try {
      const tokensSnap = await admin.database().ref(`shops/${shop}/deviceTokens`).once('value');
      const tokensObj = tokensSnap.val();
      if (tokensObj) {
        const tokens = Object.values(tokensObj).filter(Boolean);
        if (tokens.length) {
          const payload = {
            notification: {
              title: 'New customer order',
              body: `${order.customer?.name || 'Customer'} placed an order (${order.id})`,
              click_action: '/',
            },
            data: {
              orderId: order.id,
              shop: shop,
            }
          };
          // sendMulticast for up to 500 tokens
          const res = await admin.messaging().sendMulticast({ tokens, ...payload });
          console.log('FCM send result:', res.successCount, 'sent /', res.failureCount, 'failed');
        }
      }
    } catch (e) {
      console.warn('FCM send failed', e);
    }

    // Leave status as 'new' for owner to accept/handle from POS
    return null;
  });
