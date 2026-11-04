// POST /api/create-checkout-session   body: { reservationId }
// Creates a Stripe Checkout page for a confirmed, unpaid booking and returns its URL.
import { db, json, nightsCount, requireUser, stripe, todayInManila } from '../server/shared.js';

export async function POST(request) {
  const user = await requireUser(request);
  if (!user) return json({ error: 'Please log in again.' }, 401);

  const { reservationId } = await request.json().catch(() => ({}));
  if (!reservationId) return json({ error: 'Missing reservation.' }, 400);

  const snap = await db.collection('reservations').doc(reservationId).get();
  if (!snap.exists) return json({ error: 'Booking not found.' }, 404);
  const r = snap.data();

  if (r.guestId !== user.uid) return json({ error: 'This is not your booking.' }, 403);
  if (r.status !== 'confirmed') return json({ error: 'The host has not confirmed this booking.' }, 409);
  if ((r.paymentStatus ?? 'unpaid') === 'paid') return json({ error: 'This booking is already paid.' }, 409);
  if (r.checkOut < todayInManila()) return json({ error: 'This stay has already ended.' }, 409);

  // Never trust the amount stored by the browser: work it out again from the listing.
  const propertySnap = await db.collection('properties').doc(r.propertyId).get();
  if (!propertySnap.exists) return json({ error: 'This listing no longer exists.' }, 409);
  const property = propertySnap.data();
  const settings = await db.doc('settings/platform').get();
  const pctRaw = settings.exists ? Number(settings.data().serviceFeePercent) : NaN;
  const pct = Number.isFinite(pctRaw) && pctRaw >= 0 ? pctRaw : 10;

  const nights = nightsCount(r.checkIn, r.checkOut);
  const subtotal = nights * (Number(property.pricePerNight) || 0);
  const cleaning = Math.max(0, Number(property.cleaningFee) || 0);
  const service = Math.round(((subtotal + cleaning) * pct) / 100);
  const total = subtotal + cleaning + service;

  if (nights < 1 || total !== Number(r.total)) {
    return json({ error: 'The price of this booking no longer matches the listing. Please contact the host.' }, 409);
  }

  const origin = process.env.SITE_URL || request.headers.get('origin');
  if (!origin) return json({ error: 'Server is missing SITE_URL.' }, 500);

  // Stripe amounts are in centavos.
  const line = (name, pesos, description) => ({
    quantity: 1,
    price_data: {
      currency: 'php',
      unit_amount: Math.round(pesos * 100),
      product_data: { name, ...(description ? { description } : {}) },
    },
  });
  const lineItems = [
    line(r.propertyTitle, subtotal, `${nights} night${nights === 1 ? '' : 's'}, ${r.checkIn} to ${r.checkOut}`),
  ];
  if (cleaning > 0) lineItems.push(line('Cleaning fee', cleaning));
  if (service > 0) lineItems.push(line(`Service fee (${pct}%)`, service));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      client_reference_id: reservationId,
      customer_email: r.guestEmail || undefined,
      metadata: { reservationId, guestId: user.uid },
      success_url: `${origin}/my-bookings?payment=success`,
      cancel_url: `${origin}/my-bookings?payment=cancelled`,
    });
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err?.message || 'Could not start the payment.' }, 502);
  }
}