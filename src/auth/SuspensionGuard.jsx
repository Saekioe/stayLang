import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { isAdminEmail } from './Auth';

// " Contact <support email> for help." if the admin has set one in Settings, otherwise nothing.
async function supportLine() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'platform'));
    const email = snap.exists() ? String(snap.data().supportEmail ?? '').trim() : '';
    return email ? ` Contact ${email} for help.` : '';
  } catch {
    return '';
  }
}

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
            supportLine().then((help) => {
              sessionStorage.setItem(
                'authNotice',
                `Your account is suspended.${why ? ` Reason: ${why}` : ''}${help}`
              );
              signOut(auth);
            });
            return;
          }

          if (!snap.exists()) {
            // New signups get a short grace period, because the profile is saved just after the account
            const created = new Date(user.metadata.creationTime).getTime();
            const isNew = Date.now() - created < 60 * 1000;
            if (isNew) return;
            supportLine().then((help) => {
              sessionStorage.setItem('authNotice', `This account no longer exists.${help}`);
              signOut(auth);
            });
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