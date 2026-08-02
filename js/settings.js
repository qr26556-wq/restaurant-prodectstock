RESTPOS.guard(['admin'], async (user) => {
  RESTPOS.renderNav('settings', user.role, user.name);
  await loadSettings();

  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('backup30Btn').addEventListener('click', downloadLast30DaysPDF);
});

async function loadSettings() {
  try {
    const data = await DB.getSettings();
    document.getElementById('sName').value = data.restaurantName || '';
    document.getElementById('sAddress').value = data.address || '';
    document.getElementById('sPhone').value = data.phone || '';
    document.getElementById('sCurrency').value = data.currency || '₹';
    document.getElementById('sTax').value = data.taxPercent ?? 0;
    document.getElementById('sDayStart').value = data.businessDayStart || '00:00';
    document.getElementById('sDayEnd').value = data.businessDayEnd || '23:59';
    document.getElementById('sLanguage').value = data.language || 'en';
    document.getElementById('sFooter').value = data.receiptFooter || 'Thank you for dining with us!';
    document.getElementById('sPaperWidth').value = String(data.receiptPaperWidth || 80);
    document.getElementById('sAutoDelete').checked = !!data.autoDeleteOldOrders;
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not load settings: ' + err.message, 'error');
  }
}

async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  const name = document.getElementById('sName').value.trim();
  if (!name) { RESTPOS.toast('Restaurant name is required.', 'error'); return; }

  const payload = {
    restaurantName: name,
    address: document.getElementById('sAddress').value.trim(),
    phone: document.getElementById('sPhone').value.trim(),
    currency: document.getElementById('sCurrency').value.trim() || '₹',
    taxPercent: parseFloat(document.getElementById('sTax').value) || 0,
    businessDayStart: document.getElementById('sDayStart').value || '00:00',
    businessDayEnd: document.getElementById('sDayEnd').value || '23:59',
    language: document.getElementById('sLanguage').value,
    receiptFooter: document.getElementById('sFooter').value.trim(),
    receiptPaperWidth: parseInt(document.getElementById('sPaperWidth').value, 10),
    autoDeleteOldOrders: document.getElementById('sAutoDelete').checked,
  };

  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await DB.saveSettings(payload);
    window.__settings = { ...(window.__settings || {}), ...payload };
    RESTPOS.setLanguage(payload.language);
    const brandEl = document.getElementById('brandName');
    if (brandEl) brandEl.textContent = payload.restaurantName;
    document.getElementById('saveHint').textContent = 'Saved.';
    setTimeout(() => { document.getElementById('saveHint').textContent = ''; }, 2500);
    RESTPOS.toast('Settings saved.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not save settings: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
}

async function downloadLast30DaysPDF() {
  const btn = document.getElementById('backup30Btn');
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const snap = await DB.ordersRef().where('createdAt', '>=', cutoff).orderBy('createdAt', 'desc').get();
    if (snap.empty) { RESTPOS.toast('No orders in the last 30 days.', 'default'); return; }
    const s = window.__settings || {};
    const head = ['Order', 'Type', 'Items', 'Total', 'Payment', 'Status', 'Time'];
    const rows = [];
    let total = 0;
    snap.docs.forEach(d => {
      const o = d.data();
      rows.push([
        `#${o.orderNumber}`,
        (o.type || '') + (o.tableName ? ' · ' + o.tableName : ''),
        String(o.items?.length || 0),
        RESTPOS.money(o.total, s.currency),
        o.paymentMethod || '—',
        o.status,
        RESTPOS.fmtDate(o.createdAt),
      ]);
      if (o.status !== 'cancelled') total += (o.total || 0);
    });
    RESTPOS.tablePDF(
      `${(s.restaurantName || 'restaurant').replace(/\s+/g, '-').toLowerCase()}-last-30-days.pdf`,
      `${s.restaurantName || 'Restaurant'} — Last 30 Days`,
      head, rows,
      `${rows.length} orders · Total (excl. cancelled): ${RESTPOS.money(total, s.currency)} · Generated ${new Date().toLocaleString()}`
    );
    RESTPOS.toast('Backup PDF downloaded.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not build backup: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ Download last 30 days (PDF)';
  }
}
