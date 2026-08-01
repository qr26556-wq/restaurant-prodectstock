let chart;
let allProducts = [];
let todayOrders = [];

RESTPOS.guard(['admin', 'manager'], (user) => {
  RESTPOS.renderNav('dashboard', user.role, user.name);
  boot();
  if (user.role !== 'admin') {
    document.getElementById('staffLinkCard')?.remove();
  }
});

function boot() {
  DB.listenProducts(list => {
    allProducts = list;
    renderProductStats();
    renderLowStock();
    maybeShowSeedBanner();
  });

  DB.listenTodayOrders(list => {
    todayOrders = list;
    renderOrderStats();
    renderRecentOrders(list);
  });

  loadWeekChart();

  document.getElementById('seedBtn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Loading…';
    try {
      const res = await DB.seedSampleData();
      if (res.skipped) {
        RESTPOS.toast('Sample data already exists.', 'default');
      } else {
        RESTPOS.toast('Sample data loaded — categories, products & tables ready.', 'success');
        document.getElementById('seedBanner').style.display = 'none';
      }
    } catch (err) {
      console.error(err);
      RESTPOS.toast('Could not load sample data: ' + err.message, 'error');
    } finally {
      e.target.disabled = false;
      e.target.textContent = 'Load sample data';
    }
  });
}

function setStat(index, value) {
  const cards = document.querySelectorAll('#statGrid .stat-card');
  const el = cards[index]?.querySelector('.value');
  if (el) { el.classList.remove('skeleton'); el.textContent = value; el.style.width = 'auto'; }
}

function renderProductStats() {
  setStat(4, allProducts.length);
  const low = allProducts.filter(p => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5));
  setStat(5, low.length);
}

function renderOrderStats() {
  const completed = todayOrders.filter(o => o.status === 'completed');
  const pending = todayOrders.filter(o => ['new', 'preparing', 'ready', 'held'].includes(o.status));
  const salesTotal = completed.reduce((s, o) => s + (o.total || 0), 0);
  const avg = completed.length ? salesTotal / completed.length : 0;

  setStat(0, RESTPOS.money(salesTotal));
  setStat(1, todayOrders.filter(o => o.status !== 'cancelled').length);
  setStat(2, pending.length);
  setStat(3, completed.length);
  setStat(7, RESTPOS.money(avg));

  // customers is a lightweight proxy here (unique phone numbers seen today)
  const uniqueCustomers = new Set(todayOrders.filter(o => o.customer?.phone).map(o => o.customer.phone));
  setStat(6, uniqueCustomers.size);
}

function renderLowStock() {
  const host = document.getElementById('lowStockList');
  const low = allProducts.filter(p => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5))
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  if (!low.length) {
    host.innerHTML = `<p class="hint">Everything is well stocked.</p>`;
    return;
  }
  host.innerHTML = low.slice(0, 8).map(p => `
    <div class="receipt-line">
      <span class="rl-name">${RESTPOS.escapeHtml(p.name)}</span>
      <span class="rl-fill"></span>
      <span class="rl-val low-stock">${p.stock ?? 0} left</span>
    </div>`).join('');
}

function renderRecentOrders(list) {
  const tbody = document.querySelector('#recentOrdersTable tbody');
  const sorted = [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 8);
  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="hint" style="padding:16px 10px">No orders yet today.</td></tr>`;
    return;
  }
  tbody.innerHTML = sorted.map(o => `
    <tr>
      <td class="mono">#${o.orderNumber}</td>
      <td style="text-transform:capitalize">${o.type}${o.tableName ? ' · ' + o.tableName : ''}</td>
      <td>${o.items?.length || 0}</td>
      <td class="mono">${RESTPOS.money(o.total)}</td>
      <td><span class="stamp stamp-${o.status}">${o.status}</span></td>
      <td class="hint">${RESTPOS.fmtDate(o.createdAt)}</td>
    </tr>`).join('');
}

async function loadWeekChart() {
  const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
  const labels = [];
  const buckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    buckets[key] = 0;
  }
  try {
    const snap = await DB.ordersRef()
      .where('createdAt', '>=', Timestamp.fromDate(start))
      .where('status', '==', 'completed')
      .get();
    snap.docs.forEach(d => {
      const data = d.data();
      const day = data.createdAt?.toDate ? data.createdAt.toDate().toDateString() : null;
      if (day && day in buckets) buckets[day] += (data.total || 0);
    });
  } catch (e) { console.error('chart query', e); }

  const values = Object.values(buckets);
  const ctx = document.getElementById('salesChart');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Sales',
        data: values,
        borderColor: '#E8590C',
        backgroundColor: 'rgba(232,89,12,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#E8590C',
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => RESTPOS.money(v) } } },
    }
  });
}

function maybeShowSeedBanner() {
  if (allProducts.length === 0) {
    document.getElementById('seedBanner').style.display = 'block';
  }
}
