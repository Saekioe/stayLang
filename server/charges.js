// Works out what a guest owes for one payment, using the SAME pricing code as the app
// (src/dataqueries/Pricing.js). Keeping one copy means the server and the screen can
// never disagree about rounding or fees.
//
// NOTE: Pricing.js must stay free of browser-only imports, because the server loads it too.
import { cancellationFee, computeQuote, nightsCount, round2, todayISO } from '../src/dataqueries/Pricing.js';

// Must match DEFAULT_SERVICE_FEE_PERCENT and usePlatformSettings() in src/dataqueries/Booking.js.
export const DEFAULT_SERVICE_FEE_PERCENT = 10;

// The admin saves the guest fee as `guestFee` (Settings page). `serviceFeePercent` is the older name.
export const servicePercent = (settings) => {
  const pct = Number(settings?.guestFee ?? settings?.serviceFeePercent);
  return Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_SERVICE_FEE_PERCENT;
};

// A booking keeps the guest service fee it was requested with, so a later change in Settings
// never strands an unpaid booking. Older bookings without one use the current fee.
// (firestore.rules makes sure a new booking can only be created with the fee in force at that time.)
export const bookingFeePercent = (r, settings) => {
  const pct = Number(r.serviceFeePercent);
  return r.serviceFeePercent != null && Number.isFinite(pct) && pct >= 0 ? pct : servicePercent(settings);
};

export const PURPOSES = ['booking', 'cancellation', 'damage'];

// An error whose message is safe to show to the guest.
export class ChargeError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

// Returns { items: [{ name, description, pesos }], total } or throws ChargeError.
//   r            the reservation, as stored in Firestore ({ id, ...data })
//   property     the listing (booking payments are re-priced from it)
//   settings     settings/platform
//   today        today in Philippine time (YYYY-MM-DD)
//   requestedDay the day a cancellation fee was requested (fees are fixed on that day)
export function buildCharge({ purpose, r, property, settings, today = todayISO(), requestedDay }) {
  const stay = `${r.checkIn} to ${r.checkOut}`;
  let items;

  if (purpose === 'booking') {
    if (r.status !== 'confirmed') throw new ChargeError('The host has not confirmed this booking.');
    if ((r.paymentStatus ?? 'unpaid') === 'paid') throw new ChargeError('This booking is already paid.');
    if (r.checkOut < today) throw new ChargeError('This stay has already ended.');
    if (!property) throw new ChargeError('This listing no longer exists.');

    // Never trust the amount saved by the browser: price it again from the listing.
    const nights = nightsCount(r.checkIn, r.checkOut);
    const quote = computeQuote({
      pricePerNight: property.pricePerNight,
      nights,
      cleaningFee: property.cleaningFee,
      serviceFeePercent: bookingFeePercent(r, settings),
    });
    if (nights < 1 || Math.abs(quote.total - round2(r.total)) > 0.005) {
      throw new ChargeError(
        'The price of this booking no longer matches the listing. Please contact the host.'
      );
    }
    items = [{ name: r.propertyTitle, description: `${nights} night${nights === 1 ? '' : 's'}, ${stay}`, pesos: quote.subtotal }];
    if (quote.cleaningFee > 0) items.push({ name: 'Cleaning fee', pesos: quote.cleaningFee });
    if (quote.serviceFee > 0) items.push({ name: `Service fee (${quote.serviceFeePercent}%)`, pesos: quote.serviceFee });
  } else if (purpose === 'cancellation') {
    const fee = round2(r.cancellationFee);
    if (r.status !== 'confirmed' || r.cancellationFeeStatus !== 'unpaid' || !(fee > 0)) {
      throw new ChargeError('There is no cancellation fee to pay for this booking.');
    }
    // The fee is fixed on the day it was requested, so check it against the policy for that day.
    const expected = cancellationFee(r, requestedDay ?? today).fee;
    if (Math.abs(expected - fee) > 0.5) {
      throw new ChargeError('The cancellation fee does not match the cancellation policy.');
    }
    items = [{ name: 'Cancellation fee', description: `${r.propertyTitle}, ${stay}`, pesos: fee }];
  } else if (purpose === 'damage') {
    const amount = round2(r.damageAmount);
    if (r.damageStatus !== 'unpaid' || !(amount > 0)) {
      throw new ChargeError('There is no damage charge to pay for this booking.');
    }
    items = [{ name: 'Damage charge', description: String(r.damageDescription || r.propertyTitle || '').slice(0, 200), pesos: amount }];
  } else {
    throw new ChargeError('Unknown payment type.', 400);
  }

  return { items, total: round2(items.reduce((sum, i) => sum + i.pesos, 0)) };
}