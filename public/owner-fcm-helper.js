// In app.js: after successful owner sign-in we call registerMessagingTokenIfAvailable(user, shop)
// We'll patch the existing ownerSignIn function to include that call.

// (This is a small helper that will be merged into app.js when deployed)

async function _ownerSignInAndRegister(){
  const ok = await initFirebase();
  if(!ok){ flash('Firebase not configured — cannot sign in'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).then(async res=>{
    const user = res.user;
    const shop = state.shopCode;
    try{
      await firebase.database().ref('shops/' + shop).update({ ownerUid: user.uid, shopName: document.title || shop, updatedAt: Date.now() });
      flash('Signed in as ' + (user.displayName || user.email || 'owner'));
      // register FCM token if VAPID key provided
      try{ await registerMessagingTokenIfAvailable(user, shop); }catch(e){ console.warn('FCM token registration failed', e); }
      pollIncomingOrders();
    }catch(e){ console.warn('Could not write shop mapping', e); flash('Signed in but could not register shop mapping'); }
  }).catch(err=>{ console.warn(err); flash('Sign-in failed'); });
}
