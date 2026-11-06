import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { isAdminEmail } from './Auth';

export default function SuspensionGuard() {
  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      if (!user) return;
      if (isAdminEmail(user.email)) return;

      unsubDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (snap.metadata.fromCache) return;

          if (snap.exists() && snap.data().disabled) {
            const why = snap.data().disabledReason;
            sessionStorage.setItem(
              'authNotice',
              `Your account is suspended.${why ? ` Reason: ${why}` : ''}`
            );
            signOut(auth);
            return;
          }

          if (!snap.exists()) {
            // New signups get a short grace period, because the profile is saved just after the account
            const created = new Date(user.metadata.creationTime).getTime();
            const isNew = Date.now() - created < 60 * 1000;
            if (isNew) return;
            sessionStorage.setItem('authNotice', 'This account no longer exists.');
            signOut(auth);
          }
        },
        () => {}
      );
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  return null;
}