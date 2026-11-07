// One place for every number shown or saved about a reservation.
// All amounts are PHP. Dates are "YYYY-MM-DD" strings.

export const CURRENCY = 'PHP';

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Today in Philippine time, same format as reservation.checkIn / checkOut
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// Nightly rate after a deal discount. The Firestore rules use the same formula.
export const dealRate = (base, percent) => {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  return Math.round((Number(base) * (100 - pct)) / 100);
};

// Whole-day number, so date math never has time zone surprises
export const dayNum = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

export const addDaysISO = (iso, n) =>
  new Date((dayNum(iso) + n) * 86400000).toISOString().slice(0, 10);

// Check-out day is NOT a night: 10th to 13th = 3 nights (10, 11, 12)
export const nightsCount = (checkIn, checkOut) =>
  checkIn && checkOut ? Math.max(0, dayNum(checkOut) - dayNum(checkIn)) : 0;

// ["2026-11-10", "2026-11-11", "2026-11-12"] for 10th to 13th
export const nightsBetween = (checkIn, checkOut) =>
  Array.from({ length: nightsCount(checkIn, checkOut) }, (_, i) => addDaysISO(checkIn, i));

// ---------- quote (used when booking) ----------
// service fee = percent of (nights subtotal + cleaning fee)
export function computeQuote({ pricePerNight, nights, cleaningFee = 0, serviceFeePercent = 0, hostFeePercent = 0 }) {
  const n = Math.max(0, Math.floor(Number(nights) || 0));
  const nightlyRate = round2(pricePerNight);
  const subtotal = round2(nightlyRate * n);
  const cleaning = n > 0 ? round2(cleaningFee) : 0;
  const percent = Number(serviceFeePercent) || 0;
  const serviceFee = round2(((subtotal + cleaning) * percent) / 100);
  // The host fee is taken from the host's earnings. It is NOT added to what the guest pays.
  const hostPercent = Number(hostFeePercent) || 0;
  const hostFee = round2(((subtotal + cleaning) * hostPercent) / 100);
  return {
    nightlyRate,
    nights: n,
    subtotal,
    cleaningFee: cleaning,
    serviceFeePercent: percent,
    serviceFee,
    hostFeePercent: hostPercent,
    hostFee,
    total: round2(subtotal + cleaning + serviceFee),
  };
}

// ---------- cancellation policy ----------
// Must match feePercent() in firestore.rules
export const CANCELLATION_TIERS = [
  { minDays: 7, percent: 0, label: '7 or more days before check-in: no fee' },
  { minDays: 3, percent: 25, label: '3 to 6 days before check-in: 25% of the total' },
  { minDays: 1, percent: 50, label: '1 to 2 days before check-in: 50% of the total' },
];

export function cancellationFee(r, today = todayISO()) {
  const days = dayNum(r.checkIn) - dayNum(today);
  const active = r.status === 'pending' || r.status === 'confirmed';
  const tier = days >= 7 ? 0 : days >= 3 ? 25 : 50;
  const percent = r.status === 'pending' ? 0 : tier; // a request nobody confirmed is free to withdraw
  const base = reservationCharges(r).bookingTotal;
  return {
    days,
    percent,
    fee: Math.round((base * percent) / 100),
    canCancel: active && days >= 1,
  };
}

// ---------- every charge on one reservation ----------
export function reservationCharges(r) {
  const n = r.nights ?? nightsCount(r.checkIn, r.checkOut);
  const nightlyRate = round2(r.nightlyRate ?? (n ? (r.subtotal ?? 0) / n : 0));
  const subtotal = round2(r.subtotal ?? nightlyRate * n);
  const cleaningFee = round2(r.cleaningFee ?? 0);
  const serviceFee = round2(r.serviceFee ?? 0);
  // Fee taken from the host's earnings, fixed when the booking was requested (0 on older bookings)
  const hostFeePercent = Number(r.hostFeePercent) || 0;
  const hostFee = round2(((subtotal + cleaningFee) * hostFeePercent) / 100);
  // Old reservations without parts fall back to the stored total
  const hasParts = r.subtotal != null;
  const bookingTotal = hasParts ? round2(subtotal + cleaningFee + serviceFee) : round2(r.total ?? 0);
  const cancellationFeeAmount = round2(r.cancellationFee ?? 0);
  const damage = round2(r.damageAmount ?? 0);
  return {
    nights: n,
    nightlyRate,
    subtotal,
    cleaningFee,
    serviceFeePercent: r.serviceFeePercent ?? 0,
    serviceFee,
    hostFeePercent,
    hostFee,
    bookingTotal,
    cancellationFee: cancellationFeeAmount,
    damage,
    finalTotal: round2(bookingTotal + cancellationFeeAmount + damage),
  };
}

// What the guest owes for each kind of payment. Your Stripe function should use this.
export const PAY_PURPOSE = {
  booking: { field: 'paymentStatus' },
  cancellation: { field: 'cancellationFeeStatus' },
  damage: { field: 'damageStatus' },
};

export function amountDue(r, purpose = 'booking') {
  const c = reservationCharges(r);
  if (purpose === 'cancellation') return c.cancellationFee;
  if (purpose === 'damage') return c.damage;
  return c.bookingTotal;
}

// Money the guest has actually paid (booking + fee + damage)
export function amountPaid(r) {
  const c = reservationCharges(r);
  return round2(
    (r.paymentStatus === 'paid' ? c.bookingTotal : 0) +
      (r.cancellationFeeStatus === 'paid' ? c.cancellationFee : 0) +
      (r.damageStatus === 'paid' ? c.damage : 0)
  );
}

// What the host earns: nights + cleaning, minus the host service fee, + paid damage.
// (The guest service fee stays with the platform and is never part of the host's earnings.)
export function hostPayout(r) {
  const c = reservationCharges(r);
  const base = r.subtotal != null ? c.subtotal + c.cleaningFee : Math.max(0, c.bookingTotal - c.serviceFee);
  return round2(Math.max(0, base - c.hostFee) + (r.damageStatus === 'paid' ? c.damage : 0));
}

// What the platform keeps from one booking: the guest service fee plus the host service fee.
export function platformIncome(r) {
  const c = reservationCharges(r);
  return round2(c.serviceFee + c.hostFee);
}

export const CHARGE_LABELS = { unpaid: 'Unpaid', paid: 'Paid' };