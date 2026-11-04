import { useEffect, useState } from 'react';
import {
  collection, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/* ---------- currency ---------- */

export const CURRENCY = 'PHP';

const formatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// money(1500) -> "₱1,500"
export const money = (n) => formatter.format(Number(n) || 0);

/* ---------- fees ---------- */

export const DEFAULT_SERVICE_FEE_PERCENT = 10;

// The price breakdown, worked out the same way everywhere (booking card,
// saved reservation, host earnings).
//   subtotal   = nightly rate x nights
//   cleaning   = the host's fixed fee, charged once per stay
//   serviceFee = platform percentage of (subtotal + cleaning), rounded to whole pesos
//   total      = what the guest pays
export function computeQuote({
  pricePerNight,
  nights,
  cleaningFee = 0,
  serviceFeePercent = DEFAULT_SERVICE_FEE_PERCENT,
}) {
  const n = Math.max(0, Math.floor(Number(nights) || 0));
  const rate = Number(pricePerNight) || 0;
  const pct = Math.max(0, Number(serviceFeePercent) || 0);
  const cleaning = n > 0 ? Math.max(0, Number(cleaningFee) || 0) : 0;
  const subtotal = n * rate;
  const serviceFee = n > 0 ? Math.round(((subtotal + cleaning) * pct) / 100) : 0;
  return {
    nights: n,
    nightlyRate: rate,
    subtotal,
    cleaningFee: cleaning,
    serviceFeePercent: pct,
    serviceFee,
    total: subtotal + cleaning + serviceFee,
  };
}

// What the host actually earns from a reservation (the service fee goes to the platform).
// Older reservations have no serviceFee field, so they count in full.
export const hostPayout = (r) => (r.total ?? 0) - (r.serviceFee ?? 0);

// Platform-wide settings, kept in Firestore at settings/platform.
// Falls back to the default if the document is missing or cannot be read.
export function usePlatformSettings() {
  const [settings, setSettings] = useState({ serviceFeePercent: DEFAULT_SERVICE_FEE_PERCENT });

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'platform'),
        (snap) => {
          if (!snap.exists()) return;
          const pct = Number(snap.data().serviceFeePercent);
          if (Number.isFinite(pct) && pct >= 0) setSettings({ serviceFeePercent: pct });
        },
        () => {}
      ),
    []
  );

  return settings;
}

/* ---------- booking statuses ---------- */

// Stored in Firestore: pending, confirmed, declined, cancelled.
// "completed" is never stored. It is worked out from a confirmed booking whose
// check-out date has passed, so nobody has to remember to update it.
export const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function statusOf(reservation) {
  if (reservation.status === 'confirmed' && reservation.checkOut && reservation.checkOut < todayISO()) {
    return 'completed';
  }
  return reservation.status;
}

/* ---------- availability ---------- */

// Every night of a stay as "YYYY-MM-DD" strings. The check-out day is not a night,
// so a stay ending on the 5th does not block a stay starting on the 5th.
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return [];
  const [y, m, d] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  const end = Date.UTC(y2, m2 - 1, d2);
  const nights = [];
  for (let t = Date.UTC(y, m - 1, d); t < end; t += 86400000) {
    nights.push(new Date(t).toISOString().slice(0, 10));
  }
  return nights;
}

// Every taken night of one property, updating live. Each is a small document in
// `bookedNights` (id: propertyId_date): either a confirmed booking (has reservationId)
// or a night the host blocked (blocked: true).
// Firestore refuses to create a document that already exists, which is what makes
// double booking impossible even if two confirmations happen at the same moment.
export function usePropertyNights(propertyId) {
  const [nights, setNights] = useState([]);

  useEffect(() => {
    if (!propertyId) return undefined;
    return onSnapshot(
      query(collection(db, 'bookedNights'), where('propertyId', '==', propertyId)),
      (snap) =>
        setNights(
          snap.docs.map((d) => ({
            date: d.data().date,
            blocked: Boolean(d.data().blocked),
            reservationId: d.data().reservationId ?? null,
          }))
        ),
      () => setNights([])
    );
  }, [propertyId]);

  return propertyId ? nights : [];
}

// Just the dates, for checking whether a stay is free.
export const useBookedNights = (propertyId) => usePropertyNights(propertyId).map((n) => n.date);

const NO_PROPERTIES = new Set();

// Ids of the properties that have at least one taken night between check-in and
// check-out (check-out day not included). Used by the date search on Find Places.
export function useUnavailablePropertyIds(checkIn, checkOut) {
  const valid = Boolean(checkIn && checkOut && checkOut > checkIn);
  const [ids, setIds] = useState(NO_PROPERTIES);

  useEffect(() => {
    if (!valid) return undefined;
    return onSnapshot(
      query(collection(db, 'bookedNights'), where('date', '>=', checkIn), where('date', '<', checkOut)),
      (snap) => setIds(new Set(snap.docs.map((d) => d.data().propertyId))),
      () => setIds(NO_PROPERTIES)
    );
  }, [valid, checkIn, checkOut]);

  return valid ? ids : NO_PROPERTIES;
}

/* ---------- changing a booking ---------- */

// A message for the other person's inbox.
const message = (r, userId, type, extra = {}) => ({
  userId,
  reservationId: r.id,
  type,
  propertyTitle: r.propertyTitle,
  checkIn: r.checkIn,
  checkOut: r.checkOut,
  nights: r.nights ?? 0,
  total: r.total ?? 0,
  read: false,
  createdAt: serverTimestamp(),
  ...extra,
});

// Host confirms a pending request: status, the booked nights and the guest's
// message are written together, or not at all.
// Throws Error('overlap') if any of the nights is already taken.
export async function confirmReservation(r) {
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const taken = await getDocs(query(collection(db, 'bookedNights'), where('propertyId', '==', r.propertyId)));
  const takenDates = new Set(taken.docs.map((d) => d.data().date));
  if (nights.some((n) => takenDates.has(n))) throw new Error('overlap');

  const batch = writeBatch(db);
  batch.update(doc(db, 'reservations', r.id), { status: 'confirmed' });
  nights.forEach((date) => {
    batch.set(doc(db, 'bookedNights', `${r.propertyId}_${date}`), {
      propertyId: r.propertyId,
      ownerId: r.ownerId,
      guestId: r.guestId,
      reservationId: r.id,
      date,
    });
  });
  batch.set(doc(collection(db, 'notifications')), message(r, r.guestId, 'reservation_confirmed'));
  try {
    await batch.commit();
  } catch (err) {
    // A night that was taken a moment ago makes Firestore reject the whole batch.
    if (err?.code === 'permission-denied') throw new Error('overlap');
    throw err;
  }
}

export async function declineReservation(r) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reservations', r.id), { status: 'declined' });
  batch.set(doc(collection(db, 'notifications')), message(r, r.guestId, 'reservation_declined'));
  await batch.commit();
}

// Guest (by = 'guest') or host (by = 'host') cancels. Confirmed nights are freed
// so other guests can book them again, and the other person is notified.
export async function cancelReservation(r, by) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reservations', r.id), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    cancelledBy: by,
  });
  if (r.status === 'confirmed') {
    const locks = await getDocs(query(collection(db, 'bookedNights'), where('reservationId', '==', r.id)));
    locks.forEach((d) => batch.delete(d.ref));
  }
  batch.set(
    doc(collection(db, 'notifications')),
    message(r, by === 'guest' ? r.ownerId : r.guestId, 'reservation_cancelled', { cancelledBy: by })
  );
  await batch.commit();
}