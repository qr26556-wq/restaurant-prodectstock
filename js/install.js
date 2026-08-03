/* =========================================================
   INSTALL PROMPT — adds a small "Install app" button so the
   PWA can be added to the home screen / desktop, on whatever
   device it's opened on.
   - Chrome/Edge (desktop + Android): uses the native
     beforeinstallprompt flow.
   - iOS Safari: that event doesn't exist there, so instead we
     show the same button with manual "Share → Add to Home
     Screen" instructions, since that's the only way iOS allows.
   - Already installed (running standalone): button never shows.
   Include this on every page (after common.js is fine, order
   doesn't matter — this file is self-contained).
   ========================================================= */
(function () {
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  if (isStandalone()) return; // already installed — nothing to do

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  let deferredPrompt = null;
  let btn = null;

  function ensureButton() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.type = 'button';
    btn.textContent = '📲 Install app';
    btn.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:9998',
      'background:#7A0F1F', 'color:#fff', 'border:none', 'border-radius:999px',
      'padding:11px 18px', 'font-size:13.5px', 'font-weight:700',
      'box-shadow:0 6px 18px -6px rgba(0,0,0,.35)', 'cursor:pointer',
      'font-family:inherit',
    ].join(';');
    document.body.appendChild(btn);
    return btn;
  }

  function showIOSInstructions() {
    alert('Install RESTPOS on your iPhone/iPad:\n\n1. Tap the Share icon (square with an arrow) in Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"');
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const b = ensureButton();
    b.onclick = async () => {
      b.disabled = true;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome !== 'accepted') b.disabled = false;
    };
  });

  window.addEventListener('appinstalled', () => {
    if (btn) { btn.remove(); btn = null; }
    deferredPrompt = null;
  });

  // iOS never fires beforeinstallprompt — show the button with
  // manual instructions instead, once the page is ready.
  if (isIOS) {
    document.addEventListener('DOMContentLoaded', () => {
      const b = ensureButton();
      b.onclick = showIOSInstructions;
    });
  }
})();
