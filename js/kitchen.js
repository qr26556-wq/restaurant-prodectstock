const STATUS_FLOW = { new: 'preparing', preparing: 'ready', ready: 'completed' };
const STATUS_ACTION_LABEL = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark completed' };

RESTPOS.guard(['admin', 'cashier'], (user) => {
  RESTPOS.renderNav('kitchen', user.role, user.name);
  boot();
});

function boot() {
  DB.listenOrdersByStatus(['new', 'preparing', 'ready'], renderActiveOrders);
  DB.listenTodayOrders(list => renderCompleted(list.filter(o => o.status === 'completed')));
}

function ticketHtml(o) {
  const items = (o.items || []).map(i => `
    <li><span>${RESTPOS.escapeHtml(i.name)}</span><span class="mono">x${i.qty}</span></li>
    ${i.note ? `<li class="note">↳ ${RESTPOS.escapeHtml(i.note)}</li>` : ''}
  `).join('');
  const next = STATUS_FLOW[o.status];
  const label = STATUS_ACTION_LABEL[o.status];
  return `
    <div class="kot-ticket p-${o.status}">
      <div class="kot-head">
        <div>
          <div class="num">#${o.orderNumber}</div>
          <div class="meta">${o.type}${o.tableName ? ' · ' + o.tableName : ''}</div>
        </div>
        <span class="stamp stamp-${o.status}">${o.status}</span>
      </div>
      <ul class="kot-items">${items || '<li class="hint">No items</li>'}</ul>
      <div class="hint">${RESTPOS.fmtDate(o.createdAt)} · ${RESTPOS.escapeHtml(o.cashierName || '')}</div>
      ${next ? `<div class="actions">
        <button class="btn btn-sm btn-sage" style="flex:1" data-advance="${o.id}" data-next="${next}">${label}</button>
      </div>` : ''}
    </div>`;
}

function renderActiveOrders(list) {
  const cols = { new: [], preparing: [], ready: [] };
  list.forEach(o => { if (cols[o.status]) cols[o.status].push(o); });
  ['new', 'preparing', 'ready'].forEach(status => {
    const key = status.charAt(0).toUpperCase() + status.slice(1);
    const host = document.getElementById('col' + key);
    document.getElementById('count' + key).textContent = cols[status].length;
    host.innerHTML = cols[status].length
      ? cols[status].map(ticketHtml).join('')
      : `<p class="hint">No orders.</p>`;
    host.querySelectorAll('[data-advance]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await DB.updateOrderStatus(btn.dataset.advance, btn.dataset.next);
          RESTPOS.toast(`Order advanced to ${btn.dataset.next}`, 'success');
        } catch (e) {
          RESTPOS.toast('Could not update order', 'error');
          btn.disabled = false;
        }
      });
    });
  });
}

function renderCompleted(list) {
  document.getElementById('countCompleted').textContent = list.length;
  const host = document.getElementById('colCompleted');
  host.innerHTML = list.length
    ? list.slice(0, 20).map(ticketHtml).join('')
    : `<p class="hint">No completed orders yet today.</p>`;
}
