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
  apiKey: "AIzaSyBqyd1uEYfaWECMc4GDQcSDvIOosjspm_I",
  authDomain: "restaurant-prodectstock-f8a0b.firebaseapp.com",
  databaseURL: "https://restaurant-prodectstock-f8a0b-default-rtdb.firebaseio.com",
  projectId: "restaurant-prodectstock-f8a0b",
  storageBucket: "restaurant-prodectstock-f8a0b.firebasestorage.app",
  messagingSenderId: "772901074180",
  appId: "1:772901074180:web:46de8bf8808ee2afbf4c51"
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
