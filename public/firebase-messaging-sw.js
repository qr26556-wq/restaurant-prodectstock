// Service worker for Firebase messaging (optional). Place this at /public/firebase-messaging-sw.js
// This file receives background messages when the web app is not in focus.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// The hosting must inject the config as a global variable window.FIREBASE_CONFIG in the client page.
// For service worker, copy the same config here or replace the object below at deploy time.

const firebaseConfig = self.FIREBASE_CONFIG || null;
if(firebaseConfig){
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(function(payload) {
    const title = payload.notification?.title || 'New notification';
    const options = { body: payload.notification?.body || '', data: payload.data || {} };
    self.registration.showNotification(title, options);
  });
}
