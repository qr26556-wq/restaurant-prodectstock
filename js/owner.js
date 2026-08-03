const PLAN_LABELS = { pro: 'Pro (30 days)', lifetime: 'Lifetime' };

const signedOutView = document.getElementById('signedOutView');
const notOwnerView = document.getElementById('notOwnerView');
const ownerView = document.getElementById('ownerView');

function showView(view) {
  [signedOutView, notOwnerView, ownerView].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

let unsubCodes = null;

auth.onAuthStateChanged((user) => {
  if (unsubCodes) { unsubCodes(); unsubCodes = null; }
  if (!user) { showView(signedOutView); return; }
  if (user.email !== DB.OWNER_EMAIL) { showView(notOwnerView); return; }
  showView(ownerView);
  unsubCodes = DB.listenLicenseCodes(renderLicenseTable);
});

// Google sign-in that survives mobile / embedded-webview quirks:
// - the button is disabled immediately so a double-tap can't fire two
//   overlapping popups (that's what causes auth/cancelled-popup-request)
// - if a popup still can't open (blocked, or an in-app browser that
//   doesn't support window.open properly), we fall back to a redirect
async function signInGoogleSmart() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const popupFallbackCodes = [
    'auth/cancelled-popup-request',
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
  ];
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    if (popupFallbackCodes.includes(err.code)) {
      await auth.signInWithRedirect(provider); // page will navigate away and back
      return;
    }
    throw err;
  }
}

const ownerGoogleBtn = document.getElementById('ownerGoogleBtn');
ownerGoogleBtn.addEventListener('click', async () => {
  if (ownerGoogleBtn.disabled) return; // extra guard against double-tap
  ownerGoogleBtn.disabled = true;
  const originalText = ownerGoogleBtn.textContent;
  ownerGoogleBtn.textContent = 'Signing in…';
  try {
    await signInGoogleSmart();
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Sign-in failed: ' + err.message, 'error');
  } finally {
    ownerGoogleBtn.disabled = false;
    ownerGoogleBtn.textContent = originalText;
  }
});

// If we came back from a signInWithRedirect(), pick up the result here.
auth.getRedirectResult().catch((err) => {
  console.error(err);
  RESTPOS.toast('Sign-in failed: ' + err.message, 'error');
});

document.getElementById('ownerSignOutBtn').addEventListener('click', () => auth.signOut());
document.getElementById('ownerSignOutBtn2').addEventListener('click', () => auth.signOut());

document.getElementById('genLicenseBtn').addEventListener('click', async () => {
  const btn = document.getElementById('genLicenseBtn');
  const plan = document.getElementById('planSelect').value;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const code = await DB.generateLicenseCode(plan);
    document.getElementById('freshLicenseText').textContent = code;
    document.getElementById('freshLicensePlan').textContent = PLAN_LABELS[plan] || plan;
    document.getElementById('freshLicenseBox').classList.remove('hidden');
    RESTPOS.toast('Code generated — send it to the customer.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not generate a code: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Generate code';
  }
});

document.getElementById('copyLicenseBtn').addEventListener('click', async () => {
  const code = document.getElementById('freshLicenseText').textContent;
  try {
    await navigator.clipboard.writeText(code);
    RESTPOS.toast('Code copied.', 'success');
  } catch (_) {
    RESTPOS.toast('Could not copy — select and copy manually.', 'error');
  }
});

function renderLicenseTable(list) {
  const tbody = document.querySelector('#licenseTable tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="hint" style="padding:16px 10px">No codes generated yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td class="mono" style="font-weight:700; letter-spacing:1px">${RESTPOS.escapeHtml(c.id)}</td>
      <td><span class="badge badge-slate">${PLAN_LABELS[c.plan] || c.plan}</span></td>
      <td>${c.used
        ? `<span class="badge badge-sage">Used${c.usedByRestaurantName ? ' · ' + RESTPOS.escapeHtml(c.usedByRestaurantName) : ''}</span>`
        : `<span class="badge badge-amber">Unused</span>`}</td>
      <td></td>
    </tr>`).join('');
}
