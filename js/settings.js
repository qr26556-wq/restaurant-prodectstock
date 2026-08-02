let __tables = [];

RESTPOS.guard(['admin'], async (user) => {
  RESTPOS.renderNav('settings', user.role, user.name);
  await loadSettings();

  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('backup30Btn').addEventListener('click', downloadLast30DaysPDF);
  document.getElementById('pushDayStartBtn').addEventListener('click', () => setFieldToNow('sDayStart'));
  document.getElementById('pushDayEndBtn').addEventListener('click', () => setFieldToNow('sDayEnd'));

  DB.listenTables(list => { __tables = list; renderTablesList(); });
  document.getElementById('addTableBtn').addEventListener('click', addTableFromForm);
  document.getElementById('bulkTablesBtn').addEventListener('click', generate30Tables);
});

function renderTablesList() {
  const host = document.getElementById('tablesList');
  const empty = document.getElementById('tablesEmpty');
  empty.style.display = __tables.length ? 'none' : 'block';
  host.innerHTML = __tables.map(t => `
    <div class="tbl-manage-chip">
      <button class="tbl-del" data-id="${t.id}" data-name="${RESTPOS.escapeHtml(t.name)}" title="Delete ${RESTPOS.escapeHtml(t.name)}">×</button>
      <span>${RESTPOS.escapeHtml(t.name)}</span>
      <span class="seats">${t.seats || 1} seats</span>
    </div>
  `).join('');
  host.querySelectorAll('.tbl-del').forEach(btn => {
    btn.addEventListener('click', () => deleteOneTable(btn.dataset.id, btn.dataset.name));
  });
}

async function addTableFromForm() {
  const nameEl = document.getElementById('tblName');
  const seatsEl = document.getElementById('tblSeats');
  const name = nameEl.value.trim();
  if (!name) { RESTPOS.toast('Enter a table name.', 'error'); return; }
  if (__tables.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    RESTPOS.toast(`Table "${name}" already exists.`, 'error'); return;
  }
  const seats = parseInt(seatsEl.value, 10) || 1;
  try {
    await DB.addTable({ name, seats });
    nameEl.value = '';
    seatsEl.value = 4;
    RESTPOS.toast(`Table "${name}" added.`, 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not add table: ' + err.message, 'error');
  }
}

async function deleteOneTable(id, name) {
  if (!confirm(`Delete table "${name}"? This can't be undone.`)) return;
  try {
    await DB.deleteTable(id);
    RESTPOS.toast(`Table "${name}" deleted.`, 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not delete table: ' + err.message, 'error');
  }
}

async function generate30Tables() {
  const btn = document.getElementById('bulkTablesBtn');
  const countEl = document.getElementById('tblBulkCount');
  let requested = parseInt(countEl.value, 10) || 0;
  requested = Math.max(1, Math.min(200, requested));

  const existingNames = new Set(__tables.map(t => t.name.toLowerCase()));
  // build a list of up to `requested` fresh table names (T1, T2, …), skipping ones that already exist
  const names = [];
  for (let i = 1; names.length < requested && i <= 1000; i++) {
    const nm = `T${i}`;
    if (!existingNames.has(nm.toLowerCase())) names.push(nm);
    if (names.length >= requested) break;
  }
  if (!names.length) { RESTPOS.toast(`You already have ${requested}+ tables.`, 'default'); return; }

  btn.disabled = true;
  btn.textContent = `Creating ${names.length} tables…`;
  try {
    let created = 0;
    for (const nm of names) {
      const seats = created % 2 === 0 ? 4 : 2;
      await DB.addTable({ name: nm, seats });
      created++;
      btn.textContent = `Creating tables… ${created}/${names.length}`;
    }
    RESTPOS.toast(`${created} tables created.`, 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not finish creating tables: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Generate tables';
  }
}

function setFieldToNow(fieldId) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById(fieldId).value = `${hh}:${mm}`;
  RESTPOS.toast('Set to current time — tap "Save changes" to apply.', 'default');
}

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
