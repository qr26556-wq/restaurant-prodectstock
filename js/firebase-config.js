/* =========================================================
   FIREBASE CONFIG
   Paste your project's config below (Firebase Console →
   Project settings → General → Your apps → SDK setup and
   configuration). This file is safe to be public: Firebase
   web config values are identifiers, not secrets — real
   protection comes from Firestore Security Rules
   (see /firestore.rules) and Authentication settings.
   ========================================================= */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Keep the client responsive offline / on flaky wifi (tablets at the counter).
db.enablePersistence({ synchronizeTabs: true }).catch(() => {
  /* multiple tabs open or unsupported browser — safe to ignore */
});

const FieldValue = firebase.firestore.FieldValue;
const Timestamp = firebase.firestore.Timestamp;
