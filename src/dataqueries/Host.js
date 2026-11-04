import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

// Live status of the current user's host application.
// status: 'none' | 'pending' | 'approved' | 'rejected'
export function useHostApplication(uid) {
  const [state, setState] = useState({ application: null, loading: true });

  useEffect(() => {
    if (!uid) {
      setState({ application: null, loading: false });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      doc(db, 'hostApplications', uid),
      (snap) => setState({ application: snap.exists() ? snap.data() : null, loading: false }),
      () => setState({ application: null, loading: false })
    );
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