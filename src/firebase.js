import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAhxdClzBUd6IVs0ebKpy2iYpjVuCPxGgQ",
  authDomain: "staylang-5b095.firebaseapp.com",
  projectId: "staylang-5b095",
  storageBucket: "staylang-5b095.firebasestorage.app",
  messagingSenderId: "522027583973",
  appId: "1:522027583973:web:d551f021615682b8e5070c",
  measurementId: "G-CXVQQZSKRJ",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

isSupported().then((ok) => {
  if (ok) getAnalytics(app);
});