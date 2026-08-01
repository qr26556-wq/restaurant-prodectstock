let allOrders = [];
let search = '', statusFilter = 'all', typeFilter = 'all', dateFilter = '';
let currentRole = 'cashier';

RESTPOS.guard(['admin', 'cashier'], (user) => {
  currentRole = user.role;
  RESTPOS.renderNav('orders', user.role, user.name);
  boot();
});

function boot() {
  DB.listenAllOrders(list => { allOrders = list; renderTable(); });

  document.getElementById('searchInput').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.getElementById('statusFilter').addEventListener('change', e => { statusFilter = e.target.value; renderTable(); });
  document.getElementById('typeFilter').addEventListener('change', e => { typeFilter = e.target.value; renderTable(); });
  document.getElementById('dateFilter').addEventListener('change', e => { dateFilter = e.target.value; renderTable(); });
}

function renderTable() {
  let list = [...allOrders];
  if (search) list = list.filter(o =>
    String(o.orderNumber).toLowerCase().includes(search) ||
    (o.customer?.name || '').toLowerCase().includes(search) ||
    (o.customer?.phone || '').includes(search));
  if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
  if (typeFilter !== 'all') list = list.filter(o => o.type === typeFilter);
  if (dateFilter) list = list.filter(o => {
    if (!o.createdAt?.toDate) return false;
    return o.createdAt.toDate().toISOString().slice(0, 10) === dateFilter;
  });

  const tbody = document.querySelector('#ordersTable tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="hint" style="padding:16px 10px">No orders match your filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(o => `
    <tr>
      <td class="mono">#${o.orderNumber}</td>
      <td style="text-transform:capitalize">${o.type}${o.tableName ? ' · ' + o.tableName : ''}</td>
      <td>${o.items?.length || 0}</td>
      <td class="mono">${RESTPOS.money(o.total)}</td>
      <td style="text-transform:capitalize">${o.paymentMethod || '—'}</td>
      <td><span class="stamp stamp-${o.status}">${o.status}</span></td>
      <td class="hint">${RESTPOS.fmtDate(o.createdAt)}</td>
      <td><button class="btn btn-sm" data-view="${o.id}">View</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openOrder(b.dataset.view)));
}

function openOrder(id) {
  const o = allOrders.find(x => x.id === id);
  if (!o) return;
  document.getElementById('orderModalTitle').textContent = `Order #${o.orderNumber}`;

  const items = (o.items || []).map(i => `
    <div class="receipt-line"><span class="rl-name">${RESTPOS.escapeHtml(i.name)} x${i.qty}</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(i.price * i.qty)}</span></div>
  `).join('');

  document.getElementById('orderModalBody').innerHTML = `
    <div class="field-row" style="margin-bottom:14px">
      <div><label>Type</label><div style="text-transform:capitalize">${o.type}${o.tableName ? ' · ' + o.tableName : ''}</div></div>
      <div><label>Status</label><span class="stamp stamp-${o.status}">${o.status}</span></div>
    </div>
    <div class="field-row" style="margin-bottom:14px">
      <div><label>Cashier</label><div>${RESTPOS.escapeHtml(o.cashierName || '—')}</div></div>
      <div><label>Placed</label><div class="hint">${RESTPOS.fmtDate(o.createdAt)}</div></div>
    </div>
    ${o.customer?.name || o.customer?.phone ? `
    <div class="field-row" style="margin-bottom:14px">
      <div><label>Customer</label><div>${RESTPOS.escapeHtml(o.customer?.name || '—')}</div></div>
      <div><label>Phone</label><div>${RESTPOS.escapeHtml(o.customer?.phone || '—')}</div></div>
    </div>` : ''}
    <label>Items</label>
    ${items}
    <div class="receipt-line"><span class="rl-name">Subtotal</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(o.subtotal)}</span></div>
    <div class="receipt-line"><span class="rl-name">Discount</span><span class="rl-fill"></span><span class="rl-val">-${RESTPOS.money(o.discount)}</span></div>
    <div class="receipt-line"><span class="rl-name">Tax</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(o.tax)}</span></div>
    <div class="receipt-line" style="font-weight:700"><span class="rl-name">Total</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(o.total)}</span></div>
    <div class="hint" style="margin-top:6px">Paid via ${o.paymentMethod || '—'}</div>
  `;

  const canCancel = !['completed', 'cancelled'].includes(o.status);
  const statusOptions = ['new', 'preparing', 'ready', 'completed'].filter(s => s !== o.status);

  document.getElementById('orderModalFoot').innerHTML = `
    ${canCancel ? `<button class="btn btn-danger" id="cancelOrderBtn" style="margin-right:auto">Cancel order</button>` : ''}
    ${!['cancelled', 'held'].includes(o.status) ? `
      <select id="statusChange" style="width:auto">
        <option value="">Change status…</option>
        ${statusOptions.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>` : ''}
    <button class="btn" id="printOrderBtn">${RESTPOS.icon('print')} Print</button>
  `;

  document.getElementById('printOrderBtn').addEventListener('click', () => printOrder(o));
  const cancelBtn = document.getElementById('cancelOrderBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => cancelOrder(o.id));
  const statusSel = document.getElementById('statusChange');
  if (statusSel) statusSel.addEventListener('change', (e) => {
    if (e.target.value) DB.updateOrderStatus(o.id, e.target.value).then(() => {
      RESTPOS.toast('Status updated', 'success');
      RESTPOS.closeModal('orderModal');
    });
  });

  RESTPOS.openModal('orderModal');
}

async function cancelOrder(id) {
  if (!confirm('Cancel this order? Stock already deducted will be restored.')) return;
  try {
    await DB.cancelOrder(id);
    RESTPOS.toast('Order cancelled', 'success');
    RESTPOS.closeModal('orderModal');
  } catch (e) {
    console.error(e);
    RESTPOS.toast('Could not cancel order', 'error');
  }
}

function printOrder(o) {
  const s = window.__settings || {};
  const lines = (o.items || []).map(i => `
    <div class="receipt-line"><span class="rl-name">${RESTPOS.escapeHtml(i.name)} x${i.qty}</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(i.price * i.qty)}</span></div>
  `).join('');
  document.getElementById('receiptContent').innerHTML = `
    <div class="rp-center"><strong>${RESTPOS.escapeHtml(s.restaurantName || 'RESTPOS Kitchen')}</strong><br>
    ${s.address ? RESTPOS.escapeHtml(s.address) + '<br>' : ''}${s.phone ? RESTPOS.escapeHtml(s.phone) : ''}</div>
    <hr>
    Order #${o.orderNumber}<br>
    ${RESTPOS.fmtDate(o.createdAt)}<br>
    Cashier: ${RESTPOS.escapeHtml(o.cashierName || '')}<br>
    ${o.type}${o.tableName ? ' · ' + o.tableName : ''}
    <hr>
    ${lines}
    <hr>
    <div class="receipt-line"><span class="rl-name">Subtotal</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(o.subtotal)}</span></div>
    <div class="receipt-line"><span class="rl-name">Discount</span><span class="rl-fill"></span><span class="rl-val">-${RESTPOS.money(o.discount)}</span></div>
    <div class="receipt-line"><span class="rl-name">Tax</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(o.tax)}</span></div>
    <div class="receipt-line" style="font-weight:700"><span class="rl-name">Total</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(o.total)}</span></div>
    <hr>
    Paid via ${o.paymentMethod || '—'}
    <div class="rp-center" style="margin-top:8px">Thank you — visit again!</div>
  `;
  window.print();
}
