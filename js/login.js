let expectedRole = 'admin';

document.querySelectorAll('.auth-tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    expectedRole = btn.dataset.role;
  });
});

function showError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('authError').style.display = 'none';
}

// Shared Google sign-in: falls back to a redirect if a popup can't be
// used (blocked, or an in-app/embedded browser). Also guards against the
// classic "auth/cancelled-popup-request" caused by a double-tap firing
// two overlapping signInWithPopup() calls.
const popupFallbackCodes = [
  'auth/cancelled-popup-request',
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
];
async function signInGoogleSmart() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    return await auth.signInWithPopup(provider);
  } catch (err) {
    if (popupFallbackCodes.includes(err.code)) {
      await auth.signInWithRedirect(provider); // navigates away; result picked up after reload
      return null;
    }
    throw err;
  }
}
// After a redirect round-trip, finish whichever flow was in progress.
auth.getRedirectResult().then(async (result) => {
  if (!result || !result.user) return;
  const pendingAction = sessionStorage.getItem('restpos_pending_google_action');
  sessionStorage.removeItem('restpos_pending_google_action');
  try {
    if (pendingAction === 'createShop') {
      const shopName = sessionStorage.getItem('restpos_pending_shop_name') || '';
      sessionStorage.removeItem('restpos_pending_shop_name');
      await DB.createRestaurant(shopName, result.user);
      RESTPOS.toast('Your restaurant is ready!', 'success');
      window.location.href = 'dashboard.html';
    } else if (pendingAction === 'join') {
      const code = sessionStorage.getItem('restpos_pending_join_code') || '';
      sessionStorage.removeItem('restpos_pending_join_code');
      const role = await DB.redeemStaffCode(code, result.user);
      RESTPOS.toast('Welcome! Your account is ready.', 'success');
      window.location.href = (role === 'admin' || role === 'manager') ? 'dashboard.html' : 'pos.html';
    } else {
      await completeSignIn(result.user);
    }
  } catch (err) {
    console.error(err);
    showError(err.message || 'Could not finish signing in. Please try again.');
    await auth.signOut();
  }
}).catch((err) => {
  console.error(err);
  showError('Could not sign in with Google. Please try again.');
});

// If already signed in, skip straight to the right screen.
// The application pages also expose a visible Log out button; sign-out always
// returns the user to this login screen.
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if (snap.exists && snap.data().active !== false) {
      const role = snap.data().role;
      window.location.href = (role === 'admin' || role === 'manager') ? 'dashboard.html' : 'pos.html';
    }
  } catch (e) { /* stay on login */ }
});

// Shared post-auth step: every sign-in method (password or Google) lands
// here. A Firebase Auth account on its own grants nothing — access still
// depends entirely on a matching, admin-created profile in `users`, so
// self-service Google sign-up can never hand someone a role they weren't
// given on purpose.
async function completeSignIn(user) {
  const snap = await db.collection('users').doc(user.uid).get();

  if (!snap.exists) {
    showError('No staff profile is linked to this account yet. Ask an admin to add you.');
    await auth.signOut();
    return;
  }
  const profile = snap.data();
  if (profile.active === false) {
    showError('This account has been disabled. Contact an administrator.');
    await auth.signOut();
    return;
  }
  const roleLabels = { admin: 'Admin', manager: 'Manager', cashier: 'Cashier' };
  if (profile.role !== expectedRole) {
    showError(`This is a ${roleLabels[profile.role] || profile.role} account — use the "${roleLabels[profile.role] || profile.role}" tab.`);
    await auth.signOut();
    return;
  }
  window.location.href = (profile.role === 'admin' || profile.role === 'manager') ? 'dashboard.html' : 'pos.html';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const btn = document.getElementById('loginBtn');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await completeSignIn(cred.user);
  } catch (err) {
    console.error(err);
    const map = {
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/user-not-found': 'No account found with that email.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'auth/invalid-email': 'That email address doesn\'t look right.',
    };
    showError(map[err.code] || 'Could not sign in. Check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

// ---- Google sign-in ----
document.getElementById('googleBtn').addEventListener('click', async () => {
  hideError();
  const btn = document.getElementById('googleBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  sessionStorage.setItem('restpos_pending_google_action', 'signIn');
  try {
    const cred = await signInGoogleSmart();
    if (!cred) return; // redirect flow in progress; page is navigating away
    sessionStorage.removeItem('restpos_pending_google_action');
    await completeSignIn(cred.user);
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/popup-closed-by-user') {
      // user cancelled — no error needed
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      showError('This email already has a password-based account. Sign in with your email and password instead.');
    } else {
      showError('Could not sign in with Google. Please try again.');
    }
  } finally {
    btn.disabled = false;
  }
});

// ---- Create a brand-new, isolated restaurant (self-serve first admin) ----
document.getElementById('createShopGoogleBtn').addEventListener('click', async () => {
  hideError();
  const shopName = document.getElementById('shopName').value.trim();
  if (!shopName) { showError('Enter your restaurant\'s name.'); return; }
  const btn = document.getElementById('createShopGoogleBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  sessionStorage.setItem('restpos_pending_google_action', 'createShop');
  sessionStorage.setItem('restpos_pending_shop_name', shopName);
  let cred;
  try {
    cred = await signInGoogleSmart();
    if (!cred) return; // redirect flow in progress; page is navigating away
    sessionStorage.removeItem('restpos_pending_google_action');
    sessionStorage.removeItem('restpos_pending_shop_name');
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    if (err.code === 'auth/popup-closed-by-user') return;
    showError('Could not sign in with Google. Please try again.');
    return;
  }
  try {
    await DB.createRestaurant(shopName, cred.user);
    RESTPOS.toast('Your restaurant is ready!', 'success');
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error(err);
    showError(err.message || 'Could not create your restaurant. Please try again.');
    await auth.signOut();
  } finally {
    btn.disabled = false;
  }
});

// ---- Join with a staff code (first-time Google sign-in) ----
document.getElementById('joinGoogleBtn').addEventListener('click', async () => {
  hideError();
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code) { showError('Enter the code your admin gave you.'); return; }
  const btn = document.getElementById('joinGoogleBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  sessionStorage.setItem('restpos_pending_google_action', 'join');
  sessionStorage.setItem('restpos_pending_join_code', code);
  let cred;
  try {
    cred = await signInGoogleSmart();
    if (!cred) return; // redirect flow in progress; page is navigating away
    sessionStorage.removeItem('restpos_pending_google_action');
    sessionStorage.removeItem('restpos_pending_join_code');
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    if (err.code === 'auth/popup-closed-by-user') return;
    showError('Could not sign in with Google. Please try again.');
    return;
  }
  try {
    const role = await DB.redeemStaffCode(code, cred.user);
    RESTPOS.toast('Welcome! Your account is ready.', 'success');
    window.location.href = (role === 'admin' || role === 'manager') ? 'dashboard.html' : 'pos.html';
  } catch (err) {
    console.error(err);
    showError(err.message || 'Could not use that code. Please try again.');
    await auth.signOut();
  } finally {
    btn.disabled = false;
  }
});

// ---- Forgot password / Join with code (mutually exclusive panels) ----
const loginForm = document.getElementById('loginForm');
const resetForm = document.getElementById('resetForm');
const joinForm = document.getElementById('joinForm');
const createShopForm = document.getElementById('createShopForm');
const googleBtn = document.getElementById('googleBtn');
const authDivider = document.querySelector('.auth-divider');
const noAccountHint = document.getElementById('noAccountHint');
const haveCodeHint = document.getElementById('haveCodeHint');
const tabCodeHint = document.getElementById('tabCodeHint');
const authTabs = document.querySelector('.auth-tabs');

function hideAllPanels() {
  hideError();
  loginForm.classList.add('hidden');
  authDivider.classList.add('hidden');
  googleBtn.classList.add('hidden');
  noAccountHint.classList.add('hidden');
  haveCodeHint.classList.add('hidden');
  tabCodeHint.classList.add('hidden');
  resetForm.classList.add('hidden');
  joinForm.classList.add('hidden');
  createShopForm.classList.add('hidden');
  authTabs.classList.add('hidden');
}
function showResetForm() {
  hideAllPanels();
  resetForm.classList.remove('hidden');
  document.getElementById('resetEmail').value = document.getElementById('email').value.trim();
}
function showJoinForm() {
  hideAllPanels();
  joinForm.classList.remove('hidden');
}
function showCreateShopForm() {
  hideAllPanels();
  createShopForm.classList.remove('hidden');
}
function showLoginForm() {
  hideAllPanels();
  loginForm.classList.remove('hidden');
  authDivider.classList.remove('hidden');
  googleBtn.classList.remove('hidden');
  noAccountHint.classList.remove('hidden');
  haveCodeHint.classList.remove('hidden');
  tabCodeHint.classList.remove('hidden');
  authTabs.classList.remove('hidden');
}

document.getElementById('forgotBtn').addEventListener('click', showResetForm);
document.getElementById('backToLoginBtn').addEventListener('click', showLoginForm);
document.getElementById('backFromJoinBtn').addEventListener('click', showLoginForm);
document.getElementById('showCreateShopBtn').addEventListener('click', showCreateShopForm);
document.getElementById('backFromCreateShopBtn').addEventListener('click', showLoginForm);
document.getElementById('showJoinBtn').addEventListener('click', showJoinForm);
document.getElementById('showJoinBtnTop').addEventListener('click', showJoinForm);

// Arrived from the landing page's "Create your restaurant" button.
if (new URLSearchParams(location.search).get('action') === 'create') {
  showCreateShopForm();
}

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const btn = document.getElementById('resetBtn');
  const email = document.getElementById('resetEmail').value.trim();
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    await auth.sendPasswordResetEmail(email);
    showError('Reset link sent — check your inbox (and spam folder).');
    document.getElementById('authError').style.color = 'var(--sage, #2f6f4f)';
  } catch (err) {
    console.error(err);
    document.getElementById('authError').style.color = '';
    const map = {
      'auth/user-not-found': 'No account found with that email.',
      'auth/invalid-email': 'That email address doesn\'t look right.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    };
    showError(map[err.code] || 'Could not send the reset email. Check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send reset link';
  }
});
