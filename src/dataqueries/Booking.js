import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { todayISO } from './Pricing';


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



// Platform-wide settings, kept in Firestore at settings/platform.
// Falls back to the default if the document is missing or cannot be read.
export function usePlatformSettings() {
  const [settings, setSettings] = useState({ serviceFeePercent: DEFAULT_SERVICE_FEE_PERCENT, hostFeePercent: 0 });

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'platform'),
        (snap) => {
          if (!snap.exists()) return;
          // `guestFee` is what the admin saves in Settings; `serviceFeePercent` is the older name.
          const d = snap.data();
          const pct = Number(d.guestFee ?? d.serviceFeePercent);
          const hostPct = Number(d.hostFee ?? 0);
          setSettings({
            serviceFeePercent: Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_SERVICE_FEE_PERCENT,
            hostFeePercent: Number.isFinite(hostPct) && hostPct >= 0 ? hostPct : 0,
          });
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


export function statusOf(reservation) {
  if (reservation.status === 'confirmed' && reservation.checkOut && reservation.checkOut < todayISO()) {
    return 'completed';
  }
  return reservation.status;
}

/* ---------- availability ---------- */


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

/* ---------- payment (Stripe, through the /api functions) ---------- */

export const PAYMENT_LABELS = {
  unpaid: 'Awaiting payment',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

// Reservations made before payments existed have no paymentStatus.
export const paymentStatusOf = (r) => r.paymentStatus ?? 'unpaid';

// "card" -> "Card", "gcash" -> "Gcash"
export const paymentMethodLabel = (r) => {
  if (!r.paymentMethod) return '';
  const name = r.paymentMethod.charAt(0).toUpperCase() + r.paymentMethod.slice(1);
  return r.paymentLast4 ? `${name} ending ${r.paymentLast4}` : name;
};

async function callApi(path, body) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// purpose: 'booking' | 'cancellation' | 'damage'. They come back to My bookings afterwards.
export async function startCheckout(reservation, purpose = 'booking') {
  const { url } = await callApi('create-checkout-session', { reservationId: reservation.id, purpose });
  window.location.assign(url);
}

// Asks the server to check with Stripe and mark the payment as paid. Safe to call many times.
export const confirmPayment = (reservationId, purpose = 'booking', sessionId) =>
  callApi('confirm-payment', { reservationId, purpose, sessionId });

// Full refund for a cancelled booking that was paid.
export const refundReservation = (reservation) => callApi('refund-reservation', { reservationId: reservation.id });

export {
  todayISO, nightsBetween, nightsCount, computeQuote, hostPayout, platformIncome,
  cancellationFee, reservationCharges, amountDue, amountPaid,
} from './Pricing';
export {
  createReservation, confirmReservation, declineReservation, cancelReservation,
  requestCancellationFee, reportDamage,
} from './Reservation';