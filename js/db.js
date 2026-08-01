/* =========================================================
   DB — Firestore data-access layer
   Collections: users, categories, products, tables, orders, settings
   ========================================================= */
const DB = (() => {
  const col = {
    users: db.collection('users'),
    categories: db.collection('categories'),
    products: db.collection('products'),
    tables: db.collection('tables'),
    orders: db.collection('orders'),
    settings: db.collection('settings'),
  };

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
    listenCategories, addCategory, updateCategory, deleteCategory,
    listenProducts, addProduct, updateProduct, deleteProduct,
    listenTables, addTable, setTableStatus, deleteTable,
    getSettings, saveSettings,
    listenOrdersByStatus, listenAllOrders, listenTodayOrders,
    createOrder, updateOrderStatus, cancelOrder, freeTableForOrder,
    seedSampleData,
  };
})();
