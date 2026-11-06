import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

/* ---------- helpers ---------- */

export const ADMIN_EMAILS = ['admin@staylang.com'];

export const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || '').toLowerCase());

export function authMessage(code) {
  switch (code) {
    case 'auth/user-disabled':
      return 'Your account is suspended.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists. Log in with your password instead.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled yet.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in is not allowed from this website address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email/username or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}



// Accepts an email or a username and returns the email (or null if unknown).
export async function resolveEmail(identifier) {
  const value = identifier.trim();
  if (value.includes('@')) return value.toLowerCase();
  const snap = await getDoc(doc(db, 'usernames', value.toLowerCase()));
  return snap.exists() ? snap.data().email : null;
}

// Google sign-in for both the Login and Signup pages. It never throws; it returns
//   { cancelled: true }         the person closed the Google window
//   { error: 'message' }        something to show on the page
//   { user, profile, isAdmin }  signed in (profile is null for the admin)
// A first-time Google user gets a users/{uid} profile created right away.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let cred;
  try {
    cred = await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return { cancelled: true };
    }
    return { error: authMessage(err.code) };
  }

  const { user } = cred;
  try {
    if (isAdminEmail(user.email)) return { user, profile: null, isAdmin: true };

    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      if (data.disabled) {
        await signOut(auth);
        return { error: `Your account is suspended.${data.disabledReason ? ` Reason: ${data.disabledReason}` : ''}` };
      }
      return { user, profile: data, isAdmin: false };
    }

    // Signed in before but the profile is gone: the account was removed (same as email login).
    if (!getAdditionalUserInfo(cred)?.isNewUser) {
      await signOut(auth);
      return { error: 'This account no longer exists.' };
    }

    const email = (user.email || '').toLowerCase();
    const [firstName = '', ...rest] = (user.displayName || '').trim().split(/\s+/);
    const profile = {
      firstName: firstName || email.split('@')[0],
      lastName: rest.join(' '),
      email,
      photoURL: user.photoURL || '',
      provider: 'google',
    };
    await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
    return { user, profile, isAdmin: false };
  } catch {
    // Don't leave a half-made account behind (same as the email signup).
    if (getAdditionalUserInfo(cred)?.isNewUser) await deleteUser(user).catch(() => {});
    await signOut(auth).catch(() => {});
    return { error: 'Could not finish signing in with Google. Please try again.' };
  }
}

/* ---------- auth context ---------- */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        // Keep a profile that signup already set (the doc may not exist yet).
        setProfile((prev) => (snap.exists() ? snap.data() : prev));
      } catch {
        // profile stays as it is
      }
      setLoading(false);
    });
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);