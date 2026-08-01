RESTPOS.guard(['admin'], async (user) => {
  RESTPOS.renderNav('settings', user.role, user.name);
  await loadSettings();

  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
});

async function loadSettings() {
  try {
    const data = await DB.getSettings();
    document.getElementById('sName').value = data.restaurantName || '';
    document.getElementById('sAddress').value = data.address || '';
    document.getElementById('sPhone').value = data.phone || '';
    document.getElementById('sCurrency').value = data.currency || '₹';
    document.getElementById('sTax').value = data.taxPercent ?? 0;
    document.getElementById('sFooter').value = data.receiptFooter || 'Thank you for dining with us!';
    document.getElementById('sPaperWidth').value = String(data.receiptPaperWidth || 80);
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not load settings: ' + err.message, 'error');
  }
}

async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  const name = document.getElementById('sName').value.trim();
  if (!name) { RESTPOS.toast('Restaurant name is required.', 'error'); return; }

  const payload = {
    restaurantName: name,
    address: document.getElementById('sAddress').value.trim(),
    phone: document.getElementById('sPhone').value.trim(),
    currency: document.getElementById('sCurrency').value.trim() || '₹',
    taxPercent: parseFloat(document.getElementById('sTax').value) || 0,
    receiptFooter: document.getElementById('sFooter').value.trim(),
    receiptPaperWidth: parseInt(document.getElementById('sPaperWidth').value, 10),
  };

  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await DB.saveSettings(payload);
    window.__settings = { ...(window.__settings || {}), ...payload };
    const brandEl = document.getElementById('brandName');
    if (brandEl) brandEl.textContent = payload.restaurantName;
    document.getElementById('saveHint').textContent = 'Saved.';
    setTimeout(() => { document.getElementById('saveHint').textContent = ''; }, 2500);
    RESTPOS.toast('Settings saved.', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not save settings: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
}
