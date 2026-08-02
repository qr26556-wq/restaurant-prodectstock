let currentUser = null;
let allStaff = [];
let roleModalUid = null;

RESTPOS.guard(['admin'], (user) => {
  currentUser = user;
  RESTPOS.renderNav('staff', user.role, user.name);
  DB.listenStaffUsers(user.restaurantId, renderStaffTable);

  document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('addStaffBtn');
    const name = document.getElementById('newStaffName').value.trim();
    const email = document.getElementById('newStaffEmail').value.trim();
    const password = document.getElementById('newStaffPassword').value;
    const role = document.getElementById('newStaffRole').value;
    if (!name || !email || password.length < 6) {
      RESTPOS.toast('Fill in name, a valid email, and a password of at least 6 characters.', 'error');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Creating…';
    // Creating a Firebase Auth user with the client SDK normally signs
    // the app in AS that new user, which would kick the admin out of
    // their own session. To avoid that, we spin up a throwaway secondary
    // Firebase app instance just for this one signup, then discard it —
    // the admin's real session (used everywhere else, including the
    // Firestore write right below) is never touched.
    const tempApp = firebase.initializeApp(firebaseConfig, 'staffCreate-' + Date.now());
    let cred = null;
    try {
      cred = await tempApp.auth().createUserWithEmailAndPassword(email, password);
      // IMPORTANT: write the Firestore profile BEFORE signing the temp
      // session out. If we sign out first and this write then fails, the
      // auth account is left behind with no profile — an unrecoverable
      // "orphan" that then wrongly reports "email already in use" on
      // every future attempt, even though no staff member was actually
      // created. Writing first means if it fails we can still delete the
      // just-created account (below) and the email is free to retry.
      await DB.adminCreateStaff(cred.user.uid, { name, email, role });
      await tempApp.auth().signOut();
      RESTPOS.toast(`${name} can now sign in as ${role}.`, 'success');
      document.getElementById('addStaffForm').reset();
      document.getElementById('newStaffRole').value = 'cashier';
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        msg = 'That email already has an account (in this app or a previous attempt). Use a different email, or ask that person if they already have a login.';
      } else if (cred) {
        // The auth account was created but the profile write failed —
        // roll it back so this email isn't stuck as an orphan.
        try { await cred.user.delete(); } catch (_) {}
        msg += ' — the account was rolled back, so this email is free to try again.';
      }
      RESTPOS.toast('Could not create account: ' + msg, 'error');
    } finally {
      try { await tempApp.delete(); } catch (_) {}
      btn.disabled = false;
      btn.textContent = 'Create account';
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


