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

// If already signed in, skip straight to the right screen.
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if (snap.exists && snap.data().active !== false) {
      window.location.href = snap.data().role === 'admin' ? 'dashboard.html' : 'pos.html';
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
  if (expectedRole === 'admin' && profile.role !== 'admin') {
    showError('This is a staff/cashier account — use the "Staff / Cashier" tab.');
    await auth.signOut();
    return;
  }
  window.location.href = profile.role === 'admin' ? 'dashboard.html' : 'pos.html';
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
  btn.disabled = true;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await auth.signInWithPopup(provider);
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

// ---- Forgot password ----
const loginForm = document.getElementById('loginForm');
const resetForm = document.getElementById('resetForm');
const googleBtn = document.getElementById('googleBtn');
const authDivider = document.querySelector('.auth-divider');
const noAccountHint = document.getElementById('noAccountHint');

function showResetForm() {
  hideError();
  loginForm.classList.add('hidden');
  authDivider.classList.add('hidden');
  googleBtn.classList.add('hidden');
  noAccountHint.classList.add('hidden');
  resetForm.classList.remove('hidden');
  document.getElementById('resetEmail').value = document.getElementById('email').value.trim();
}
function showLoginForm() {
  hideError();
  resetForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authDivider.classList.remove('hidden');
  googleBtn.classList.remove('hidden');
  noAccountHint.classList.remove('hidden');
}

document.getElementById('forgotBtn').addEventListener('click', showResetForm);
document.getElementById('backToLoginBtn').addEventListener('click', showLoginForm);

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
