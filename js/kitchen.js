const STATUS_FLOW = { new: 'preparing', preparing: 'ready', ready: 'completed' };
const STATUS_ACTION_LABEL = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark completed' };
const ticketsById = {};

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
      <div class="actions" style="display:flex; gap:6px">
        <button class="btn btn-sm" data-print="${o.id}">🖨 Print</button>
        <button class="btn btn-sm" data-pdf="${o.id}">⬇ PDF</button>
      </div>
      ${next ? `<div class="actions">
        <button class="btn btn-sm btn-sage" style="flex:1" data-advance="${o.id}" data-next="${next}">${label}</button>
      </div>` : ''}
    </div>`;
}

function ticketPrintHtml(o) {
  const items = (o.items || []).map(i => `
    <div class="receipt-line"><span class="rl-name">${RESTPOS.escapeHtml(i.name)} x${i.qty}</span></div>
    ${i.note ? `<div class="hint">↳ ${RESTPOS.escapeHtml(i.note)}</div>` : ''}
  `).join('');
  return `
    <div class="rp-center"><strong>KITCHEN ORDER</strong></div>
    <hr>
    Order #${o.orderNumber}<br>
    ${RESTPOS.fmtDate(o.createdAt)}<br>
    ${o.type}${o.tableName ? ' · ' + o.tableName : ''}
    <hr>
    ${items}
    <hr>
    <div class="rp-center">No prices on kitchen copy</div>
  `;
}

function printTicket(o) {
  document.getElementById('receiptContent').innerHTML = ticketPrintHtml(o);
  window.print();
}

function pdfTicket(o) {
  if (typeof window.jspdf === 'undefined') { RESTPOS.toast('PDF tool still loading — try again in a moment', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
  let y = 8;
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text('KITCHEN ORDER', 40, y, { align: 'center' }); y += 7;
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text(`Order #${o.orderNumber}`, 4, y); y += 4.5;
  doc.text(RESTPOS.fmtDate(o.createdAt), 4, y); y += 4.5;
  doc.text(`${o.type}${o.tableName ? ' · ' + o.tableName : ''}`, 4, y); y += 4.5;
  doc.line(4, y, 76, y); y += 4;
  (o.items || []).forEach(i => {
    doc.text(`${i.name} x${i.qty}`, 4, y); y += 4.5;
    if (i.note) { doc.setFontSize(8); doc.text(`↳ ${i.note}`, 6, y); doc.setFontSize(9); y += 4.2; }
  });
  doc.line(4, y, 76, y); y += 5;
  doc.text('No prices on kitchen copy', 40, y, { align: 'center' });
  doc.save(`kot-${o.orderNumber || Date.now()}.pdf`);
}

function renderActiveOrders(list) {
  const cols = { new: [], preparing: [], ready: [] };
  list.forEach(o => { ticketsById[o.id] = o; if (cols[o.status]) cols[o.status].push(o); });
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
    wireTicketExportButtons(host);
  });
}

function wireTicketExportButtons(host) {
  host.querySelectorAll('[data-print]').forEach(btn => {
    btn.addEventListener('click', () => { const o = ticketsById[btn.dataset.print]; if (o) printTicket(o); });
  });
  host.querySelectorAll('[data-pdf]').forEach(btn => {
    btn.addEventListener('click', () => { const o = ticketsById[btn.dataset.pdf]; if (o) pdfTicket(o); });
  });
}

function renderCompleted(list) {
  document.getElementById('countCompleted').textContent = list.length;
  const host = document.getElementById('colCompleted');
  host.innerHTML = list.length
    ? list.slice(0, 20).map(ticketHtml).join('')
    : `<p class="hint">No completed orders yet today.</p>`;
}
