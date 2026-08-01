/* =========================================================
   DB — Firestore data-access layer
   Multi-tenant: every shop is its own /restaurants/{restaurantId}
   document. Its categories/products/tables/orders/settings live in
   subcollections underneath it, so one shop's data is a completely
   separate branch of the database from another's — never the same
   collection. `users` and `staffCodes` stay top-level (keyed by uid /
   code) but every doc carries a `restaurantId` so rules can fence them.
   Call DB.init(restaurantId) once, right after login, before using any
   of the restaurant-scoped functions below.
   ========================================================= */
const DB = (() => {
  const top = {
    users: db.collection('users'),
    staffCodes: db.collection('staffCodes'),
    restaurants: db.collection('restaurants'),
  };
  let RID = null;
  let col = {}; // categories/products/tables/orders/settings — set by init()

  function init(restaurantId) {
    RID = restaurantId;
    const shop = top.restaurants.doc(restaurantId);
    col = {
      categories: shop.collection('categories'),
      products: shop.collection('products'),
      tables: shop.collection('tables'),
      orders: shop.collection('orders'),
      settings: shop.collection('settings'),
    };
  }

  /* ---------------- Restaurants (shops) ---------------- */
  // Self-serve "create a brand-new shop": the caller becomes its first
  // admin. One Google account can only ever own/belong to ONE shop — if
  // this uid already has a users/{uid} profile, Firestore rules refuse
  // the write (it becomes an "update", which only an existing admin of
  // that same shop may do), so we check up front for a friendly message.
  async function createRestaurant(name, user) {
    const existing = await top.users.doc(user.uid).get();
    if (existing.exists) {
      throw new Error('This Google account is already linked to a restaurant. Sign out and use a different account, or ask your admin for a staff join code instead.');
    }
    const restRef = top.restaurants.doc();
    const batch = db.batch();
    batch.set(restRef, {
      name: name || 'My Restaurant',
      ownerUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(top.users.doc(user.uid), {
      name: user.displayName || user.email,
      email: user.email,
      role: 'admin',
      active: true,
      restaurantId: restRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return restRef.id;
  }

  /* ---------------- Categories ---------------- */
  function listenCategories(cb) {
    return col.categories.orderBy('sortOrder', 'asc').onSnapshot(
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('categories listen', err)
    );
  }
  function addCategory(data) {
    return col.categories.add({ enabled: true, sortOrder: Date.now(), createdAt: FieldValue.serverTimestamp(), ...data });
  }
  function updateCategory(id, data) { return col.categories.doc(id).update(data); }
  function deleteCategory(id) { return col.categories.doc(id).delete(); }

  /* ---------------- Products ---------------- */
  function listenProducts(cb) {
    return col.products.orderBy('name', 'asc').onSnapshot(
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('products listen', err)
    );
  }
  function addProduct(data) {
    return col.products.add({
      available: true, stock: 0, lowStockThreshold: 5,
      createdAt: FieldValue.serverTimestamp(), ...data
    });
  }
  function updateProduct(id, data) { return col.products.doc(id).update(data); }
  function deleteProduct(id) { return col.products.doc(id).delete(); }

  /* ---------------- Tables ---------------- */
  function listenTables(cb) {
    return col.tables.orderBy('name', 'asc').onSnapshot(
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('tables listen', err)
    );
  }
  function addTable(data) { return col.tables.add({ status: 'available', currentOrderId: null, ...data }); }
  function setTableStatus(id, status, currentOrderId = null) {
    return col.tables.doc(id).update({ status, currentOrderId });
  }
  function deleteTable(id) { return col.tables.doc(id).delete(); }

  /* ---------------- Settings ---------------- */
  function getSettings() { return col.settings.doc('general').get().then(d => d.exists ? d.data() : {}); }
  function saveSettings(data) { return col.settings.doc('general').set(data, { merge: true }); }

  /* ---------------- Orders ---------------- */
  function listenOrdersByStatus(statuses, cb) {
    return col.orders.where('status', 'in', statuses).orderBy('createdAt', 'desc').onSnapshot(
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('orders listen', err)
    );
  }
  function listenAllOrders(cb, limit = 200) {
    return col.orders.orderBy('createdAt', 'desc').limit(limit).onSnapshot(
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('orders listen', err)
    );
  }
  function listenTodayOrders(cb) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return col.orders.where('createdAt', '>=', Timestamp.fromDate(start)).onSnapshot(
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('today orders listen', err)
    );
  }

  // Creates an order. A "held" order is just a saved cart — no payment taken yet,
  // so stock is untouched. Any other status (new/preparing/ready/completed) means
  // billing is done and the order is live, so stock is committed transactionally.
  // A dine-in table is marked occupied as soon as an order (held or live) uses it.
  async function createOrder(order) {
    const committing = order.status !== 'held';
    return db.runTransaction(async (tx) => {
      const productRefs = order.items.map(it => col.products.doc(it.productId));
      const productSnaps = committing
        ? await Promise.all(productRefs.map(r => tx.get(r)))
        : [];

      if (committing) {
        productSnaps.forEach((snap, i) => {
          const need = order.items[i].qty;
          const have = snap.exists ? (snap.data().stock || 0) : 0;
          if (have < need) {
            throw new Error(`Not enough stock for ${order.items[i].name} (have ${have}, need ${need})`);
          }
        });
      }

      const orderRef = col.orders.doc();
      tx.set(orderRef, {
        ...order,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (committing) {
        productSnaps.forEach((snap, i) => {
          const have = snap.exists ? (snap.data().stock || 0) : 0;
          tx.update(productRefs[i], { stock: have - order.items[i].qty });
        });
      }
      if (order.tableId) {
        tx.update(col.tables.doc(order.tableId), { status: 'occupied', currentOrderId: orderRef.id });
      }
      return orderRef.id;
    });
  }

  function updateOrderStatus(id, status) {
    return col.orders.doc(id).update({ status, updatedAt: FieldValue.serverTimestamp() });
  }

  async function cancelOrder(id) {
    const ref = col.orders.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    const batch = db.batch();
    batch.update(ref, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
    // restore stock if it had already been decremented
    if (data.status === 'completed' || data.status === 'ready' || data.status === 'preparing' || data.status === 'new') {
      data.items.forEach(it => {
        batch.update(col.products.doc(it.productId), { stock: FieldValue.increment(it.qty) });
      });
    }
    if (data.tableId) batch.update(col.tables.doc(data.tableId), { status: 'available', currentOrderId: null });
    return batch.commit();
  }

  function freeTableForOrder(tableId) {
    if (!tableId) return Promise.resolve();
    return col.tables.doc(tableId).update({ status: 'available', currentOrderId: null });
  }

  // Escape hatch for one-off queries (e.g. the dashboard's 7-day chart)
  // that need the raw, restaurant-scoped orders collection reference.
  function ordersRef() { return col.orders; }

  /* ---------------- Staff join codes ----------------
     An admin generates a short code tied to a role. A new staff member
     opens login.html on their own phone, taps "Join with a staff code",
     enters the code, and signs in with Google. If the code is valid and
     unused, their `users/{uid}` profile is created with that role and the
     code is marked used — all inside one transaction so a code can never
     be redeemed twice, even if two people try at the same moment. */
  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function generateStaffCode(role, restaurantId, createdByUid, createdByName) {
    // avoid (extremely unlikely) collision with an existing code — codes
    // are globally unique across every restaurant, since a brand-new
    // joiner looks one up by code alone, before they belong to any shop.
    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = genCode();
      const existing = await top.staffCodes.doc(code).get();
      if (!existing.exists) break;
    }
    await top.staffCodes.doc(code).set({
      role, restaurantId, used: false, usedBy: null, usedByName: null, usedAt: null,
      createdBy: createdByUid, createdByName: createdByName || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return code;
  }

  function listenStaffCodes(restaurantId, cb) {
    return top.staffCodes.where('restaurantId', '==', restaurantId).onSnapshot(
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        cb(list);
      },
      err => console.error('staffCodes listen', err)
    );
  }

  function deleteStaffCode(code) { return top.staffCodes.doc(code).delete(); }

  // Redeems a code for the currently-signed-in Google user, creating their
  // staff profile — with the role AND restaurantId carried by the code —
  // so they land inside the correct, single shop. Throws a plain Error
  // with a user-facing message on any failure (bad code, already used,
  // etc.) so the caller can sign the user back out and show it.
  async function redeemStaffCode(code, user) {
    const codeRef = top.staffCodes.doc(code);
    const userRef = top.users.doc(user.uid);
    return db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error('That code doesn\'t look right. Double-check it with your admin.');
      const codeData = codeSnap.data();
      if (codeData.used) throw new Error('That code has already been used. Ask your admin for a new one.');

      const userSnap = await tx.get(userRef);
      if (userSnap.exists) throw new Error('This Google account already has a staff profile — just sign in normally.');

      tx.set(userRef, {
        name: user.displayName || user.email,
        email: user.email,
        role: codeData.role,
        restaurantId: codeData.restaurantId,
        active: true,
        joinedViaCode: code,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(codeRef, {
        used: true, usedBy: user.uid, usedByName: user.displayName || user.email,
        usedAt: FieldValue.serverTimestamp(),
      });
      return codeData.role;
    });
  }

  /* ---------------- Seed sample data (admin, one-time) ---------------- */
  async function seedSampleData() {
    const catSnap = await col.categories.limit(1).get();
    if (!catSnap.empty) return { skipped: true };

    const categories = [
      { name: 'Starters', icon: '🥗' },
      { name: 'Main Course', icon: '🍛' },
      { name: 'Pizza', icon: '🍕' },
      { name: 'Beverages', icon: '🥤' },
      { name: 'Desserts', icon: '🍰' },
    ];
    const catIds = {};
    for (const c of categories) {
      const ref = await addCategory(c);
      catIds[c.name] = ref.id;
    }

    const products = [
      { name: 'Paneer Tikka', category: 'Starters', price: 220, costPrice: 120, stock: 40, sku: 'STR-001' },
      { name: 'Spring Rolls', category: 'Starters', price: 180, costPrice: 90, stock: 35, sku: 'STR-002' },
      { name: 'Butter Chicken', category: 'Main Course', price: 320, costPrice: 190, stock: 25, sku: 'MAIN-001' },
      { name: 'Dal Makhani', category: 'Main Course', price: 240, costPrice: 110, stock: 30, sku: 'MAIN-002' },
      { name: 'Veg Biryani', category: 'Main Course', price: 260, costPrice: 130, stock: 20, sku: 'MAIN-003' },
      { name: 'Margherita Pizza', category: 'Pizza', price: 280, costPrice: 140, stock: 15, sku: 'PIZ-001' },
      { name: 'Farmhouse Pizza', category: 'Pizza', price: 340, costPrice: 180, stock: 15, sku: 'PIZ-002' },
      { name: 'Fresh Lime Soda', category: 'Beverages', price: 90, costPrice: 30, stock: 60, sku: 'BEV-001' },
      { name: 'Cold Coffee', category: 'Beverages', price: 130, costPrice: 55, stock: 3, sku: 'BEV-002' },
      { name: 'Gulab Jamun', category: 'Desserts', price: 110, costPrice: 45, stock: 25, sku: 'DES-001' },
    ];
    for (const p of products) {
      await addProduct({
        name: p.name, categoryId: catIds[p.category], categoryName: p.category,
        price: p.price, costPrice: p.costPrice, stock: p.stock, sku: p.sku,
        description: '', imageUrl: '', available: true, lowStockThreshold: 5,
      });
    }

    for (let i = 1; i <= 8; i++) {
      await addTable({ name: `T${i}`, seats: i % 2 === 0 ? 4 : 2 });
    }

    await saveSettings({
      restaurantName: 'RESTPOS Kitchen', address: '', phone: '', currency: '₹', taxPercent: 5,
    });

    return { skipped: false };
  }

  return {
    init, createRestaurant, ordersRef,
    listenCategories, addCategory, updateCategory, deleteCategory,
    listenProducts, addProduct, updateProduct, deleteProduct,
    listenTables, addTable, setTableStatus, deleteTable,
    getSettings, saveSettings,
    listenOrdersByStatus, listenAllOrders, listenTodayOrders,
    createOrder, updateOrderStatus, cancelOrder, freeTableForOrder,
    generateStaffCode, listenStaffCodes, deleteStaffCode, redeemStaffCode,
    seedSampleData,
  };
})();
