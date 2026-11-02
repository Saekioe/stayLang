import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
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