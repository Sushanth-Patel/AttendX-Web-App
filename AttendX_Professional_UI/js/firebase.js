// js/firebase.js

const firebaseConfig = {
  apiKey: "AIzaSyBMNvXtfGmvwcgTUnYcXmjM6pQcXQUV_tM",
  authDomain: "college-app-7d229.firebaseapp.com",
  projectId: "college-app-7d229",
  storageBucket: "college-app-7d229.firebasestorage.app",
  messagingSenderId: "1083201723228",
  appId: "1:1083201723228:web:f5afc6f362ccd87a9abf99",
  measurementId: "G-EZSL47F7SB"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();
