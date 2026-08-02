const checksHost = document.getElementById('checks');
const rows = {};

function addRow(id, title) {
  const div = document.createElement('div');
  div.className = 'diag-row';
  div.innerHTML = `<div class="diag-dot pending" id="dot-${id}"></div>
    <div><div class="diag-title">${title}</div><div class="diag-detail" id="detail-${id}">Checking…</div></div>`;
  checksHost.appendChild(div);
  rows[id] = div;
}
function setResult(id, status, detail) {
  document.getElementById('dot-' + id).className = 'diag-dot ' + status;
  document.getElementById('detail-' + id).textContent = detail;
}

addRow('config', 'Firebase config');
addRow('network', 'Internet connection');
addRow('firestore', 'Firestore reachable');
addRow('auth', 'Sign-in status');
addRow('profile', 'Staff profile (users/{uid})');
addRow('sw', 'Service worker / offline cache');

async function runDiagnostics() {
  // 1) Config — catches the exact "YOUR_API_KEY" placeholder bug
  try {
    const cfg = firebaseConfig;
    const placeholder = Object.entries(cfg).find(([k, v]) => typeof v === 'string' && v.startsWith('YOUR_'));
    if (placeholder) {
      setResult('config', 'fail', `"${placeholder[0]}" is still a placeholder ("${placeholder[1]}"). Paste your real Firebase config into js/firebase-config.js.`);
    } else if (!firebase.apps.length) {
      setResult('config', 'fail', 'firebase.initializeApp() did not run — check js/firebase-config.js loaded before this script.');
    } else {
      setResult('config', 'pass', `Project: ${cfg.projectId}`);
    }
  } catch (e) {
    setResult('config', 'fail', 'firebaseConfig is missing entirely: ' + e.message);
  }

  // 2) Network
  setResult('network', navigator.onLine ? 'pass' : 'fail', navigator.onLine ? 'Browser reports online.' : 'Browser reports OFFLINE — check wifi/data.');

  // 3) Firestore reachability — any real response (even "permission-denied")
  // proves the project/network path works; only a network-level error means
  // Firestore itself is unreachable.
  try {
    await db.collection('restaurants').limit(1).get();
    setResult('firestore', 'pass', 'Firestore responded normally.');
  } catch (e) {
    if (e.code === 'permission-denied') {
      setResult('firestore', 'pass', 'Firestore reachable (got "permission-denied" as expected while signed out — this is normal, not a bug).');
    } else {
      setResult('firestore', 'fail', `${e.code || ''} ${e.message}`);
    }
  }

  // 4 & 5) Auth + profile
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setResult('auth', 'warn', 'Not signed in right now — that\'s fine if you haven\'t logged in yet on this device.');
      setResult('profile', 'warn', 'Skipped — sign in first, then reload this page to check the profile.');
      return;
    }
    setResult('auth', 'pass', `Signed in as ${user.email || user.uid} (uid: ${user.uid})`);
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      if (!snap.exists) {
        setResult('profile', 'fail', 'No users/{uid} document for this account. This is exactly the "No staff profile is linked" error — an admin needs to add this account from the Staff page, or use "Create your shop" if this should be a brand-new restaurant.');
      } else {
        const d = snap.data();
        setResult('profile', 'pass', `role: ${d.role}, active: ${d.active !== false}, restaurantId: ${d.restaurantId}`);
      }
    } catch (e) {
      setResult('profile', 'fail', `${e.code || ''} ${e.message}`);
    }
  });

  // 6) Service worker
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) {
        setResult('sw', 'warn', 'No service worker registered yet on this device (normal on first visit).');
      } else {
        const details = regs.map(r => `scope=${r.scope} active=${!!r.active}`).join(' | ');
        setResult('sw', 'pass', details);
      }
    } catch (e) {
      setResult('sw', 'fail', e.message);
    }
  } else {
    setResult('sw', 'warn', 'This browser does not support service workers.');
  }
}

runDiagnostics();

document.getElementById('copyBtn').addEventListener('click', async () => {
  const lines = ['RESTPOS Diagnostics Report', new Date().toString(), ''];
  Object.keys(rows).forEach(id => {
    const title = rows[id].querySelector('.diag-title').textContent;
    const status = document.getElementById('dot-' + id).className.replace('diag-dot ', '');
    const detail = document.getElementById('detail-' + id).textContent;
    lines.push(`[${status.toUpperCase()}] ${title}: ${detail}`);
  });
  lines.push('', 'JS errors caught:');
  if (!jsErrors.length) lines.push('  none');
  else jsErrors.forEach(e => lines.push(`  [${e.time}] ${e.msg}`));
  lines.push('', `User agent: ${navigator.userAgent}`);

  const report = lines.join('\n');
  try {
    await navigator.clipboard.writeText(report);
    const btn = document.getElementById('copyBtn');
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = old; }, 1500);
  } catch (e) {
    alert(report); // fallback: show it so it can be selected/copied manually
  }
});
