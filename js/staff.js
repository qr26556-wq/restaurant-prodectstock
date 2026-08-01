let currentUser = null;
let allStaff = [];
let roleModalUid = null;

RESTPOS.guard(['admin'], (user) => {
  currentUser = user;
  RESTPOS.renderNav('staff', user.role, user.name);
  DB.listenStaffUsers(user.restaurantId, renderStaffTable);
  DB.listenStaffCodes(user.restaurantId, renderStaffCodes);

  document.getElementById('genCodeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('genCodeBtn');
    const role = document.getElementById('genCodeRole').value;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      const code = await DB.generateStaffCode(role, user.restaurantId, user.uid, user.name);
      RESTPOS.toast(`Code ${code} ready — share it with the new ${role}.`, 'success');
    } catch (err) {
      console.error(err);
      RESTPOS.toast('Could not generate a code: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate code';
    }
  });

  document.getElementById('saveRoleBtn').addEventListener('click', async () => {
    if (!roleModalUid) return;
    const role = document.getElementById('roleSelect').value;
    try {
      await DB.updateUserRole(roleModalUid, role);
      RESTPOS.toast('Role updated.', 'success');
      RESTPOS.closeModal('roleModal');
    } catch (err) {
      console.error(err);
      RESTPOS.toast('Could not update role: ' + err.message, 'error');
    }
  });
});

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', cashier: 'Cashier' };

function renderStaffTable(list) {
  allStaff = list;
  const tbody = document.querySelector('#staffTable tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="hint" style="padding:16px 10px">No staff found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const isSelf = u.id === currentUser.uid;
    const active = u.active !== false;
    return `
    <tr>
      <td>${RESTPOS.escapeHtml(u.name || '—')}${isSelf ? ' <span class="hint">(you)</span>' : ''}</td>
      <td class="hint">${RESTPOS.escapeHtml(u.email || '—')}</td>
      <td><span class="badge badge-slate" style="text-transform:capitalize">${ROLE_LABELS[u.role] || u.role}</span></td>
      <td>${active ? '<span class="badge badge-sage">Active</span>' : '<span class="badge badge-alert">Disabled</span>'}</td>
      <td style="display:flex; gap:6px; justify-content:flex-end">
        <button class="icon-btn" title="Change role" data-edit="${u.id}">${RESTPOS.icon('edit')}</button>
        <button class="icon-btn" title="${active ? 'Disable' : 'Enable'}" data-toggle="${u.id}">${RESTPOS.icon(active ? 'x' : 'check')}</button>
        ${!isSelf ? `<button class="icon-btn" title="Remove access" data-remove="${u.id}">${RESTPOS.icon('trash')}</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openRoleModal(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleActive(btn.dataset.toggle));
  });
  tbody.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeStaff(btn.dataset.remove));
  });
}

function openRoleModal(uid) {
  const u = allStaff.find(x => x.id === uid);
  if (!u) return;
  roleModalUid = uid;
  document.getElementById('roleModalWho').textContent = `${u.name || u.email} — pick a new role`;
  document.getElementById('roleSelect').value = u.role;
  RESTPOS.openModal('roleModal');
}

async function toggleActive(uid) {
  const u = allStaff.find(x => x.id === uid);
  if (!u) return;
  const nextActive = u.active === false;
  if (u.id === currentUser.uid && !nextActive) {
    RESTPOS.toast("You can't disable your own account.", 'error');
    return;
  }
  try {
    await DB.setUserActive(uid, nextActive);
    RESTPOS.toast(nextActive ? 'Account enabled.' : 'Account disabled.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not update account: ' + err.message, 'error');
  }
}

async function removeStaff(uid) {
  const u = allStaff.find(x => x.id === uid);
  if (!u) return;
  if (!confirm(`Remove ${u.name || u.email}'s access to this restaurant? This can't be undone from here — they would need a new staff join code to come back.`)) return;
  try {
    await DB.removeStaffProfile(uid);
    RESTPOS.toast('Access removed.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not remove access: ' + err.message, 'error');
  }
}

function renderStaffCodes(list) {
  const host = document.getElementById('staffCodesList');
  if (!list.length) {
    host.innerHTML = `<p class="hint">No codes generated yet.</p>`;
    return;
  }
  host.innerHTML = list.map(c => `
    <div class="receipt-line">
      <span class="rl-name mono" style="letter-spacing:2px; font-weight:700">${c.id}</span>
      <span style="text-transform:capitalize; margin-left:10px">${RESTPOS.escapeHtml(c.role)}</span>
      <span class="rl-fill"></span>
      ${c.used
        ? `<span class="stamp stamp-completed">used — ${RESTPOS.escapeHtml(c.usedByName || '')}</span>`
        : `<span class="stamp stamp-new">unused</span>
           <button class="icon-btn" title="Delete code" data-del="${c.id}">${RESTPOS.icon('trash')}</button>`
      }
    </div>`).join('');

  host.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this unused code?')) return;
      try { await DB.deleteStaffCode(btn.dataset.del); }
      catch (err) { RESTPOS.toast('Could not delete: ' + err.message, 'error'); }
    });
  });
}
