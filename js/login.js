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
    const snap = await db.collection('users').doc(cred.user.uid).get();

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
