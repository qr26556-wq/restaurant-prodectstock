let __tables = [];
let __settings = {};
let __currentUser = null;

RESTPOS.guard(['admin'], async (user) => {
  __currentUser = user;
  RESTPOS.renderNav('settings', user.role, user.name);
  await loadSettings();
  await loadBranches();

  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('backup30Btn').addEventListener('click', downloadLast30DaysPDF);
  document.getElementById('prefetchOfflineBtn').addEventListener('click', prefetchForOffline);
  document.getElementById('pushDayStartBtn').addEventListener('click', () => setFieldToNow('sDayStart'));
  document.getElementById('pushDayEndBtn').addEventListener('click', () => setFieldToNow('sDayEnd'));
  document.getElementById('redeemLicenseBtn').addEventListener('click', redeemLicense);
  const addBranchBtn = document.getElementById('addBranchBtn');
  if (addBranchBtn) addBranchBtn.addEventListener('click', addBranch);
  const branchList = document.getElementById('branchList');
  if (branchList) branchList.addEventListener('click', handleBranchAction);

  DB.listenTables(list => { __tables = list; renderTablesList(); });
  document.getElementById('addTableBtn').addEventListener('click', addTableFromForm);
  document.getElementById('bulkTablesBtn').addEventListener('click', generate30Tables);
});

async function loadBranches() {
  const card = document.getElementById('branchManagementCard');
  const list = document.getElementById('branchList');
  if (!card || !list) return;
  try {
    const enabled = await DB.hasActiveMultiBranchPlan();
    if (!enabled) { card.style.display = 'none'; return; }
    const branches = await DB.listBranches();
    card.style.display = branches.length >= 1 ? '' : 'none';
    list.innerHTML = branches.map(b => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line,#ead9ad)">
        <div style="flex:1"><strong>${RESTPOS.escapeHtml(b.name)}</strong>${b.isMain ? ' <span class="badge badge-slate">Main</span>' : ''}</div>
        ${b.id === DB.activeRestaurantId() ? '<span class="badge badge-sage">Current</span>' : `<button class="btn btn-sm" data-branch-action="switch" data-branch-id="${RESTPOS.escapeHtml(b.branchRestaurantId || b.id)}">Switch</button>`}
        ${!b.isMain ? `<button class="btn btn-sm" data-branch-action="edit" data-branch-id="${RESTPOS.escapeHtml(b.branchRestaurantId || b.id)}" data-branch-name="${RESTPOS.escapeHtml(b.name)}">Edit</button><button class="btn btn-sm" data-branch-action="delete" data-branch-id="${RESTPOS.escapeHtml(b.branchRestaurantId || b.id)}">Delete</button>` : ''}
      </div>`).join('');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not load branches: ' + err.message, 'error');
  }
}

async function addBranch() {
  const input = document.getElementById('newBranchName');
  const btn = document.getElementById('addBranchBtn');
  const name = input.value.trim();
  if (!name) { RESTPOS.toast('Enter a branch name.', 'error'); return; }
  btn.disabled = true;
  try {
    await DB.createBranch(name);
    input.value = '';
    await loadBranches();
    RESTPOS.toast('Branch created in Firebase Cloud.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not create branch: ' + err.message, 'error');
  } finally { btn.disabled = false; }
}

async function handleBranchAction(e) {
  const btn = e.target.closest('[data-branch-action]');
  if (!btn) return;
  const id = btn.dataset.branchId;
  if (btn.dataset.branchAction === 'switch') DB.switchBranch(id);
  if (btn.dataset.branchAction === 'edit') {
    const current = btn.dataset.branchName || '';
    const name = prompt('Branch name:', current);
    if (name === null) return;
    try { await DB.updateBranch(id, name); await loadBranches(); RESTPOS.toast('Branch updated.', 'success'); }
    catch (err) { RESTPOS.toast('Could not update branch: ' + err.message, 'error'); }
    return;
  }
  if (btn.dataset.branchAction === 'delete') {
    if (!confirm('Delete this branch? Its cloud data will remain in Firebase but the branch will be disabled.')) return;
    try { await DB.deleteBranch(id); await loadBranches(); RESTPOS.toast('Branch disabled.', 'success'); }
    catch (err) { RESTPOS.toast('Could not delete branch: ' + err.message, 'error'); }
  }
}

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

const PLAN_DISPLAY = {
  starter: 'Starter',
  pro: 'Pro',
  lifetime: 'Lifetime',
  multibranch: 'Multi-branch (30 days)',
  multibranch_lifetime: 'Multi-branch Lifetime',
};

function renderPlanStatus() {
  const el = document.getElementById('planStatus');
  const plan = __settings.plan;
  if (!plan) {
    el.textContent = "You're on the Free plan. Enter an activation code below to upgrade.";
    return;
  }
  if (plan === 'lifetime') {
    el.innerHTML = `<span class="badge badge-sage">Lifetime</span> Active — never expires. Thanks for your support!`;
    return;
  }
  if (PLAN_DISPLAY[plan]) {
    const label = PLAN_DISPLAY[plan];
    const exp = __settings.planExpiresAt;
    const expDate = exp && exp.toDate ? exp.toDate() : (exp ? new Date(exp) : null);
    const expired = expDate && expDate.getTime() < Date.now();
    if (expired) {
      el.innerHTML = `<span class="badge badge-alert">${label} — expired</span> Your ${label} plan ran out on ${expDate.toLocaleDateString()}. Enter a new code to renew.`;
    } else {
      el.innerHTML = `<span class="badge badge-sage">${label}</span> Active${expDate ? ' — renews/expires ' + expDate.toLocaleDateString() : ''}.`;
    }
    return;
  }
  el.textContent = `Plan: ${plan}`;
}

async function redeemLicense() {
  const btn = document.getElementById('redeemLicenseBtn');
  const input = document.getElementById('licenseCodeInput');
  const code = input.value.trim().toUpperCase();
  if (!code) { RESTPOS.toast('Enter the activation code first.', 'error'); return; }
  btn.disabled = true;
  btn.textContent = 'Activating…';
  try {
    const result = await DB.redeemLicenseCode(code, __currentUser.restaurantId, __settings.restaurantName);
    RESTPOS.toast(`${PLAN_NAMES[result.plan] || result.plan} activated!`, 'success');
    input.value = '';
    await loadSettings();
  await loadBranches();
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not activate: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Activate';
  }
}

const PLAN_NAMES = {
  starter: 'Starter',
  pro: 'Pro',
  lifetime: 'Lifetime',
  multibranch: 'Multi-branch (30 days)',
  multibranch_lifetime: 'Multi-branch Lifetime'
};

async function loadSettings() {
  try {
    const data = await DB.getSettings();
    let globalPlan = {};
    try {
      const rootSnap = await db.collection('restaurants').doc(DB.rootRestaurantId()).collection('settings').doc('general').get();
      if (rootSnap.exists) globalPlan = rootSnap.data() || {};
    } catch (_) {}
    const merged = { ...data, plan: globalPlan.plan || data.plan, planExpiresAt: globalPlan.planExpiresAt || data.planExpiresAt, planActivatedAt: globalPlan.planActivatedAt || data.planActivatedAt };
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
    __settings = merged;
    renderPlanStatus();
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

async function prefetchForOffline() {
  const btn = document.getElementById('prefetchOfflineBtn');
  const status = document.getElementById('prefetchStatus');
  if (!navigator.onLine) {
    RESTPOS.toast("You're offline right now — connect to wifi first, then try this.", 'error');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Downloading…';
  status.textContent = '';
  try {
    const counts = await DB.prefetchOfflineData(30);
    status.textContent = `Saved on this device: ${counts.orders} orders, ${counts.products} products, ${counts.categories} categories, ${counts.tables} tables. Ready to use offline.`;
    RESTPOS.toast('Last 30 days are now saved on this device.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not prepare offline data: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📴 Prepare last 30 days for offline use';
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
