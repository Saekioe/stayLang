import {
  collection, doc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { nightsBetween, nightsCount } from './Pricing';

export const MAX_DAMAGE_PHOTOS = 3;

const nightRef = (propertyId, date) => doc(db, 'bookedNights', `${propertyId}_${date}`);

// `writer` is a transaction or a write batch (both have .set)
const addNotification = (writer, userId, recipient, type, r, extra = {}) => {
  writer.set(doc(collection(db, 'notifications')), {
    userId,
    recipient, // 'guest' | 'host'
    type,
    read: false,
    reservationId: r.id,
    propertyId: r.propertyId,
    propertyTitle: r.propertyTitle ?? '',
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights: r.nights ?? nightsCount(r.checkIn, r.checkOut),
    total: r.total ?? 0,
    createdAt: serverTimestamp(),
    ...extra,
  });
};

// Small JPEG data URL, same approach as the listing form
export function compressPhoto(file, maxSize = 700, quality = 0.5) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

// ---------- guest sends a request ----------
// Reservation + notifications are written together in one batch.
export async function createReservation({ place, user, profile, checkIn, checkOut, party, quote }) {
  const nights = nightsCount(checkIn, checkOut);
  if (nights < 1) throw new Error('dates');

  const mine = await getDocs(
    query(
      collection(db, 'reservations'),
      where('guestId', '==', user.uid),
      where('propertyId', '==', place.id)
    )
  );
  const clash = mine.docs.some((d) => {
    const x = d.data();
    return (x.status === 'pending' || x.status === 'confirmed') && x.checkIn < checkOut && x.checkOut > checkIn;
  });
  if (clash) throw new Error('clash');

  const ref = doc(collection(db, 'reservations'));
  const data = {
    propertyId: place.id,
    propertyTitle: place.name,
    ownerId: place.ownerId,

    guestId: user.uid,
    guestName: profile ? `${profile.firstName} ${profile.lastName}` : user.displayName || user.email,
    guestEmail: user.email,
    guestPhone: profile?.phone || '',

    checkIn,
    checkOut,
    nights,

    // `guests` is adults + children, so older screens and capacity checks keep working
    guests: party.adults + party.children,
    adults: party.adults,
    children: party.children,
    infants: party.infants,
    pets: party.pets,

    nightlyRate: quote.nightlyRate,
    subtotal: quote.subtotal,
    cleaningFee: quote.cleaningFee,
    serviceFeePercent: quote.serviceFeePercent,
    serviceFee: quote.serviceFee,
    total: quote.total,

    currency: 'PHP',
    paymentStatus: 'unpaid',
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  const r = { id: ref.id, ...data };
  batch.set(ref, data);
  addNotification(batch, place.ownerId, 'host', 'reservation_requested', r, { guestName: data.guestName });
  addNotification(batch, user.uid, 'guest', 'reservation_pending', r);
  await batch.commit();
  return ref.id;
}

// ---------- host confirms ----------
// One transaction: the nights are reserved, the booking is confirmed and every other
// pending request for overlapping dates is declined with a notification.
// bookedNights ids are "<propertyId>_<date>" and cannot be overwritten (rules deny update),
// so two bookings can never hold the same night, even with two hosts' tabs open.
export async function confirmReservation(r) {
  const nights = nightsBetween(r.checkIn, r.checkOut);

  // Queries cannot run inside a transaction, so find the rivals first and re-check them inside.
  const pendingSnap = await getDocs(
    query(
      collection(db, 'reservations'),
      where('ownerId', '==', r.ownerId),
      where('propertyId', '==', r.propertyId),
      where('status', '==', 'pending')
    )
  );
  const rivals = pendingSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => o.id !== r.id && o.checkIn < r.checkOut && o.checkOut > r.checkIn);

  let declined = 0;
  await runTransaction(db, async (tx) => {
    declined = 0; // the function can run more than once
    const resRef = doc(db, 'reservations', r.id);

    // all reads first
    const resSnap = await tx.get(resRef);
    if (!resSnap.exists() || resSnap.data().status !== 'pending') throw new Error('not-pending');
    const nightSnaps = await Promise.all(nights.map((d) => tx.get(nightRef(r.propertyId, d))));
    if (nightSnaps.some((s) => s.exists())) throw new Error('overlap');
    const rivalSnaps = await Promise.all(rivals.map((o) => tx.get(doc(db, 'reservations', o.id))));

    // then writes
    tx.update(resRef, { status: 'confirmed', confirmedAt: serverTimestamp() });
    nights.forEach((date) =>
      tx.set(nightRef(r.propertyId, date), {
        propertyId: r.propertyId,
        ownerId: r.ownerId,
        guestId: r.guestId,
        reservationId: r.id,
        date,
        createdAt: serverTimestamp(),
      })
    );
    addNotification(tx, r.guestId, 'guest', 'reservation_confirmed', r);

    rivalSnaps.forEach((snap, i) => {
      if (!snap.exists() || snap.data().status !== 'pending') return;
      tx.update(snap.ref, { status: 'declined', declinedAt: serverTimestamp(), declineReason: 'dates_unavailable' });
      addNotification(tx, rivals[i].guestId, 'guest', 'reservation_unavailable', rivals[i]);
      declined += 1;
    });
  });
  return { declined };
}

// ---------- host declines ----------
export async function declineReservation(r) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reservations', r.id), {
    status: 'declined',
    declinedAt: serverTimestamp(),
    declineReason: 'host_declined',
  });
  addNotification(batch, r.guestId, 'guest', 'reservation_declined', r);
  await batch.commit();
}

// ---------- guest: ask for the cancellation fee ----------
// The booking stays active until the fee is paid. Rules re-check the amount.
export async function requestCancellationFee(r, info) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reservations', r.id), {
    cancellationFee: info.fee,
    cancellationFeePercent: info.percent,
    cancellationFeeStatus: 'unpaid',
    cancellationRequestedAt: serverTimestamp(),
  });
  addNotification(batch, r.guestId, 'guest', 'cancellation_fee_due', r, { amount: info.fee });
  await batch.commit();
}

// ---------- final cancellation (guest or host) ----------
// One transaction: status, dates open again, both sides notified.
export async function cancelReservation(r, by) {
  const nights = nightsBetween(r.checkIn, r.checkOut);
  await runTransaction(db, async (tx) => {
    const resRef = doc(db, 'reservations', r.id);
    const resSnap = await tx.get(resRef);
    if (!resSnap.exists() || !['pending', 'confirmed'].includes(resSnap.data().status)) {
      throw new Error('not-active');
    }
    const nightSnaps = await Promise.all(nights.map((d) => tx.get(nightRef(r.propertyId, d))));

    tx.update(resRef, { status: 'cancelled', cancelledBy: by, cancelledAt: serverTimestamp() });

    // Free the dates, but only the ones that belong to this reservation
    nightSnaps.forEach((s) => {
      if (!s.exists()) return;
      const d = s.data();
      const mine = d.reservationId ? d.reservationId === r.id : d.guestId === r.guestId;
      if (mine) tx.delete(s.ref);
    });

    addNotification(tx, r.guestId, 'guest', 'reservation_cancelled', r, { cancelledBy: by });
    addNotification(tx, r.ownerId, 'host', 'reservation_cancelled', r, { cancelledBy: by });
  });
}

// ---------- host reports damage after the stay ----------
export async function reportDamage(r, { amount, description, photos = [] }) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!(value > 0)) throw new Error('amount');
  if (!description.trim()) throw new Error('description');

  const batch = writeBatch(db);
  batch.update(doc(db, 'reservations', r.id), {
    damageAmount: value,
    damageDescription: description.trim(),
    damagePhotos: photos.slice(0, MAX_DAMAGE_PHOTOS),
    damageStatus: 'unpaid',
    damageReportedAt: serverTimestamp(),
  });
  addNotification(batch, r.guestId, 'guest', 'damage_reported', r, { amount: value });
  await batch.commit();
}