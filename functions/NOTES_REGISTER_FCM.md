// Owner-side FCM registration support: when owner signs in, attempt to get messaging token (if VAPID key provided)
// and store it at shops/{shopCode}/deviceTokens/{uid} so Cloud Function can push notifications.

async function registerMessagingTokenIfAvailable(user, shop){
  try {
    if (typeof firebase === 'undefined' || !firebase.messaging) return;
    const vapidKey = window.FIREBASE_VAPID_KEY || null; // set this in your host if you want push
    if(!vapidKey) return;
    const messaging = firebase.messaging();
    // Request permission
    const permission = await Notification.requestPermission();
    if(permission !== 'granted') return;
    const currentToken = await messaging.getToken({ vapidKey });
    if(currentToken){
      const key = `shops/${shop}/deviceTokens/${user.uid}`;
      await firebase.database().ref(key).set(currentToken);
      console.log('Registered FCM token for owner', user.uid);
    }
  } catch(e){ console.warn('Could not register messaging token', e); }
}

// Modify ownerSignIn in app.js to call registerMessagingTokenIfAvailable after sign-in succeeds
// (This patch assumes ownerSignIn already performs firebase.auth().signInWithPopup)

