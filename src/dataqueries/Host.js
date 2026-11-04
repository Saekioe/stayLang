import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

// Live status of the current user's host application.
// status: 'none' | 'pending' | 'approved' | 'rejected'
// blocked: true if Firestore never answered (for example an ad blocker is stopping it)
export function useHostApplication(uid) {
  const [state, setState] = useState({ application: null, loading: true, blocked: false });

  useEffect(() => {
    if (!uid) {
      setState({ application: null, loading: false, blocked: false });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true, blocked: false }));

    // If Firestore never answers, stop the loading state after 8 seconds.
    const timer = setTimeout(() => {
      setState((s) => (s.loading ? { ...s, loading: false, blocked: true } : s));
    }, 8000);

    const unsub = onSnapshot(
      doc(db, 'hostApplications', uid),
      (snap) => {
        clearTimeout(timer);
        setState({ application: snap.exists() ? snap.data() : null, loading: false, blocked: false });
      },
      () => {
        clearTimeout(timer);
        setState({ application: null, loading: false, blocked: false });
      }
    );

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [uid]);

  return { ...state, status: state.application?.status ?? 'none' };
}

// Sending again after a rejection simply overwrites the old application.
export function submitHostApplication(uid, data) {
  return setDoc(doc(db, 'hostApplications', uid), {
    ...data,
    ownerId: uid,
    status: 'pending',
    reviewNote: '',
    submittedAt: serverTimestamp(),
  });
}

// Same idea as in ListingForm: shrink a photo into a JPEG data URL.
export function compressImage(file, maxSize = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}