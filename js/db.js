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
    licenseCodes: db.collection('licenseCodes'),
  };
  let RID = null;
  let ROOT_RID = null;
  let col = {}; // categories/products/tables/orders/settings — set by init()

  function init(restaurantId, rootRestaurantId = null) {
    RID = restaurantId;
    ROOT_RID = rootRestaurantId || restaurantId;
    const shop = top.restaurants.doc(restaurantId);
    col = {
      categories: shop.collection('categories'),
      products: shop.collection('products'),
      tables: shop.collection('tables'),
      orders: shop.collection('orders'),
      sales: shop.collection('sales'),
      customers: shop.collection('customers'),
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
    // These must be two SEPARATE, sequential writes rather than one batch.
    // The security rule for creating the admin's users/{uid} profile checks
    // (via get()) that the restaurant doc already exists — and a get()
    // inside a rule can never see another write from the same batch, only
    // what's already committed. Batching both together always fails with
    // "Missing or insufficient permissions". Awaiting the restaurant write
    // first makes sure it's actually committed before the profile write
    // is attempted.
    await restRef.set({
      name: name || 'My Restaurant',
      ownerUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    await top.users.doc(user.uid).set({
      name: user.displayName || user.email,
      email: user.email,
      role: 'admin',
      active: true,
      restaurantId: restRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    return restRef.id;
  }

  /* ---------------- Multi-branch cloud management ---------------- */
  function rootRestaurantId() { return ROOT_RID || RID; }
  function activeRestaurantId() { return RID; }
  function isMainBranch() { return RID === rootRestaurantId(); }
  function branchesRef() { return top.restaurants.doc(rootRestaurantId()).collection('branches'); }

  async function hasActiveMultiBranchPlan() {
    const rootId = rootRestaurantId();
    const snap = await top.restaurants.doc(rootId).collection('settings').doc('general').get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    if (!['multibranch','multibranch_lifetime'].includes(data.plan)) return false;
    if (data.plan === 'multibranch_lifetime') return true;
    if (!data.planExpiresAt) return false;
    const exp = data.planExpiresAt.toDate ? data.planExpiresAt.toDate() : new Date(data.planExpiresAt);
    return exp.getTime() > Date.now();
  }

  async function listBranchSummaries() {
    const branches = await listBranches();
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0);
    const startTs = Timestamp.fromDate(start);
    const out = [];
    for (const b of branches.filter(x => x.active !== false)) {
      const shop = top.restaurants.doc(b.branchRestaurantId || b.id);
      const [productsSnap, ordersSnap] = await Promise.all([
        shop.collection('products').get(),
        shop.collection('orders').where('createdAt', '>=', startTs).get(),
      ]);
      const orders = ordersSnap.docs.map(d => d.data());
      const completed = orders.filter(o => o.status === 'completed');
      out.push({
        id: b.branchRestaurantId || b.id,
        name: b.name,
        products: productsSnap.size,
        lowStock: productsSnap.docs.filter(d => { const x=d.data(); return (x.stock ?? 0) <= (x.lowStockThreshold ?? 5); }).length,
        orders: orders.filter(o => o.status !== 'cancelled').length,
        pending: orders.filter(o => ['new','preparing','ready','held'].includes(o.status)).length,
        sales: completed.reduce((sum,o)=>sum+(o.total||0),0),
      });
    }
    return out;
  }

  async function listBranches() {
    const rootId = rootRestaurantId();
    const snap = await branchesRef().orderBy('createdAt', 'asc').get();
    const branches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rootSnap = await top.restaurants.doc(rootId).get();
    const rootData = rootSnap.exists ? rootSnap.data() : {};
    return [{
      id: rootId,
      branchRestaurantId: rootId,
      name: rootData.name || 'Main Branch',
      isMain: true,
      active: true,
    }, ...branches];
  }

  async function createBranch(name) {
    if (!RID || !ROOT_RID) throw new Error('Restaurant is not loaded.');
    const rootId = rootRestaurantId();
    if (!(await hasActiveMultiBranchPlan())) throw new Error('An active Multi-branch plan (30 days or Lifetime) is required to add branches.');
    const rootSnap = await top.restaurants.doc(rootId).get();
    if (!rootSnap.exists || rootSnap.data().ownerUid !== auth.currentUser?.uid) {
      throw new Error('Only the restaurant owner can create branches.');
    }
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Enter a branch name.');
    const branchRestaurant = top.restaurants.doc();
    await branchRestaurant.set({
      name: cleanName,
      ownerUid: auth.currentUser.uid,
      parentRestaurantId: rootId,
      branch: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await branchesRef().doc(branchRestaurant.id).set({
      branchRestaurantId: branchRestaurant.id,
      name: cleanName,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await top.restaurants.doc(branchRestaurant.id).collection('settings').doc('general').set({
      restaurantName: cleanName,
      currency: 'Rs',
      taxPercent: 0,
      language: 'en',
      receiptFooter: 'Thank you for dining with us!',
      branchOf: rootId,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return branchRestaurant.id;
  }

  async function updateBranch(branchId, name) {
    if (!branchId || branchId === rootRestaurantId()) throw new Error('The main branch cannot be edited here.');
    if (!(await hasActiveMultiBranchPlan())) throw new Error('An active Multi-branch plan (30 days or Lifetime) is required.');
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Enter a branch name.');
    const rootId = rootRestaurantId();
    const rootSnap = await top.restaurants.doc(rootId).get();
    if (!rootSnap.exists || rootSnap.data().ownerUid !== auth.currentUser?.uid) throw new Error('Only the restaurant owner can edit branches.');
    await branchesRef().doc(branchId).set({ name: cleanName }, { merge: true });
    await top.restaurants.doc(branchId).set({ name: cleanName }, { merge: true });
    await top.restaurants.doc(branchId).collection('settings').doc('general').set({ restaurantName: cleanName }, { merge: true });
  }

  async function deleteBranch(branchId) {
    if (!branchId || branchId === rootRestaurantId()) throw new Error('The main branch cannot be deleted.');
    await branchesRef().doc(branchId).delete();
    await top.restaurants.doc(branchId).update({ active: false });
    if (RID === branchId) {
      localStorage.removeItem('restpos_active_branch');
      window.location.reload();
    }
  }

  function switchBranch(branchId) {
    const id = branchId || rootRestaurantId();
    localStorage.setItem('restpos_active_branch', id);
    window.location.reload();
  }

  function clearBranchSelection() {
    localStorage.removeItem('restpos_active_branch');
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

  /* ---------------- Sales / Customers ---------------- */
  function listenSales(cb) { return col.sales.orderBy('createdAt', 'desc').onSnapshot(s => cb(s.docs.map(d => ({id:d.id,...d.data()}))), e => console.error('sales listen', e)); }
  function addSale(data) { return col.sales.add({ createdAt: FieldValue.serverTimestamp(), ...data }); }
  function listenCustomers(cb) { return col.customers.orderBy('name', 'asc').onSnapshot(s => cb(s.docs.map(d => ({id:d.id,...d.data()}))), e => console.error('customers listen', e)); }
  function upsertCustomer(id, data) { return col.customers.doc(id).set({ updatedAt: FieldValue.serverTimestamp(), ...data }, {merge:true}); }

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
  // "Today" respects the shop's configured business-day start time
  // (Settings → business day starts at), so a restaurant open past
  // midnight doesn't see its sales reset to zero at 12:00 AM. Falls
  // back to plain midnight if no custom start time is set.
  function businessDayStartTimestamp(businessDayStart) {
    const [h, m] = (businessDayStart || '00:00').split(':').map(Number);
    const now = new Date();
    const start = new Date(now);
    start.setHours(h || 0, m || 0, 0, 0);
    if (now < start) start.setDate(start.getDate() - 1); // still "yesterday's" business day
    return Timestamp.fromDate(start);
  }

  function listenTodayOrders(cb) {
    getSettings().then(settings => {
      const startTs = businessDayStartTimestamp(settings.businessDayStart);
      col.orders.where('createdAt', '>=', startTs).onSnapshot(
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => console.error('today orders listen', err)
      );
    });
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

  // Data retention: permanently deletes orders older than `days`. Only
  // called when the admin has explicitly turned this on in Settings —
  // it is destructive and NOT reversible, so callers should always
  // encourage a PDF backup first. Batches in chunks of 400 to stay
  // under Firestore's 500-writes-per-batch limit.
  async function pruneOldOrders(days) {
    const cutoff = Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    let deleted = 0;
    while (true) {
      const snap = await col.orders.where('createdAt', '<', cutoff).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.docs.length;
      if (snap.docs.length < 400) break;
    }
    return deleted;
  }

  /* ---------------- Staff (users) management ---------------- */
  function listenStaffUsers(restaurantId, cb) {
    return top.users.where('restaurantId', '==', restaurantId).onSnapshot(
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        cb(list);
      },
      err => console.error('staff users listen', err)
    );
  }
  function updateUserRole(uid, role) { return top.users.doc(uid).update({ role }); }
  function setUserActive(uid, active) { return top.users.doc(uid).update({ active }); }
  // Admin-provisioned account: writes the profile doc using the ADMIN's
  // own authenticated session (this module's `db`), not the new staff
  // member's — matches firestore.rules clause (3) for /users/{uid} create.
  function adminCreateStaff(uid, { name, email, role }) {
    return top.users.doc(uid).set({
      name, email, role,
      active: true,
      restaurantId: RID,
      createdAt: FieldValue.serverTimestamp(),
      createdVia: 'admin',
    });
  }
  // Removing the profile doc revokes all access for that Google account
  // (their auth account itself still exists, but without a users/{uid}
  // profile they can no longer sign in to this shop's data at all).
  function removeStaffProfile(uid) { return top.users.doc(uid).delete(); }

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

  const OWNER_EMAIL = 'qraza2376@gmail.com';

  // --- Plan / billing activation codes ---
  // Only the product owner (see firestore.rules) can successfully create
  // one of these — this function will simply fail with a permission error
  // for anyone else, which is the intended behaviour, not a bug.
  async function generateLicenseCode(plan) {
    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = genCode();
      const existing = await top.licenseCodes.doc(code).get();
      if (!existing.exists) break;
    }
    const durationDays = (plan === 'lifetime' || plan === 'multibranch_lifetime') ? null : 30; // Lifetime never expires; every other paid plan renews monthly
    await top.licenseCodes.doc(code).set({
      plan, durationDays, used: false,
      usedByRestaurantId: null, usedByRestaurantName: null, usedAt: null,
      createdByEmail: OWNER_EMAIL,
      createdAt: FieldValue.serverTimestamp(),
    });
    return code;
  }

  // Owner-only: every code ever generated, newest first.
  function listenLicenseCodes(cb) {
    return top.licenseCodes.onSnapshot(
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        cb(list);
      },
      err => console.error('licenseCodes listen', err)
    );
  }

  // A restaurant admin redeems a code they received after paying. Marks
  // the code used AND stamps the restaurant's own settings with the new
  // plan in the same transaction, so the two can never drift apart.
  async function redeemLicenseCode(code, restaurantId, restaurantName) {
    const codeRef = top.licenseCodes.doc(code);
    const settingsRef = top.restaurants.doc(rootRestaurantId()).collection('settings').doc('general');
    return db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new Error("That code doesn't look right. Double-check it with us.");
      const codeData = codeSnap.data();
      if (codeData.used) throw new Error('That code has already been used. Ask us for a new one.');

      const expiresAt = codeData.durationDays
        ? Timestamp.fromDate(new Date(Date.now() + codeData.durationDays * 24 * 60 * 60 * 1000))
        : null;

      tx.update(codeRef, {
        used: true, usedByRestaurantId: restaurantId, usedByRestaurantName: restaurantName || null,
        usedAt: FieldValue.serverTimestamp(),
      });
      tx.set(settingsRef, {
        plan: codeData.plan,
        planExpiresAt: expiresAt,
        planActivatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { plan: codeData.plan, expiresAt };
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

  // Deliberately "touches" every collection the app needs day-to-day so
  // Firestore's local cache (enabled in firebase-config.js) actually holds
  // it — persistence only caches what's been read at least once, it
  // doesn't grab a date range on its own. Call this once while online
  // (e.g. from a Settings button) to guarantee real offline coverage
  // instead of hoping the right pages happened to be visited already.
  async function prefetchOfflineData(days = 30) {
    const cutoff = Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    const [ordersSnap, productsSnap, categoriesSnap, tablesSnap] = await Promise.all([
      col.orders.where('createdAt', '>=', cutoff).orderBy('createdAt', 'desc').get(),
      col.products.orderBy('name', 'asc').get(),
      col.categories.orderBy('sortOrder', 'asc').get(),
      col.tables.orderBy('name', 'asc').get(),
    ]);
    return {
      orders: ordersSnap.size,
      products: productsSnap.size,
      categories: categoriesSnap.size,
      tables: tablesSnap.size,
    };
  }

  return {
    init, createRestaurant, ordersRef, pruneOldOrders,
    listenCategories, addCategory, updateCategory, deleteCategory,
    listenProducts, addProduct, updateProduct, deleteProduct,
    listenTables, addTable, setTableStatus, deleteTable,
    getSettings, saveSettings,
    listenOrdersByStatus, listenAllOrders, listenTodayOrders,
    createOrder, updateOrderStatus, cancelOrder, freeTableForOrder,
    listenStaffUsers, updateUserRole, setUserActive, removeStaffProfile, adminCreateStaff,
    generateStaffCode, listenStaffCodes, deleteStaffCode, redeemStaffCode,
    generateLicenseCode, listenLicenseCodes, redeemLicenseCode, OWNER_EMAIL,
    rootRestaurantId, activeRestaurantId, isMainBranch, listBranches, listBranchSummaries, hasActiveMultiBranchPlan, createBranch, updateBranch, deleteBranch, switchBranch, clearBranchSelection, listenSales, addSale, listenCustomers, upsertCustomer,
    seedSampleData, prefetchOfflineData,
  };
})();
