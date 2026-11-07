// POST /api/create-checkout-session   body: { reservationId, purpose }
// purpose: 'booking' (default) | 'cancellation' | 'damage'
// Creates a Stripe Checkout page for what the guest owes and returns its URL.
import { db, json, requireUser, stripe } from '../server/shared.js';
import { ChargeError, PURPOSES, buildCharge } from '../server/charges.js';

// A Firestore timestamp as a Philippine-time date (YYYY-MM-DD).
const manilaDay = (ts) =>
  ts?.toDate ? new Date(ts.toDate().getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) : undefined;

export async function POST(request) {
  const user = await requireUser(request);
  if (!user) return json({ error: 'Please log in again.' }, 401);

  const { reservationId, purpose = 'booking' } = await request.json().catch(() => ({}));
  if (!reservationId) return json({ error: 'Missing reservation.' }, 400);
  if (!PURPOSES.includes(purpose)) return json({ error: 'Unknown payment type.' }, 400);

  const snap = await db.collection('reservations').doc(reservationId).get();
  if (!snap.exists) return json({ error: 'Booking not found.' }, 404);
  const r = { id: snap.id, ...snap.data() };
  if (r.guestId !== user.uid) return json({ error: 'This is not your booking.' }, 403);

  let charge;
  try {
    const propertySnap = purpose === 'booking' ? await db.collection('properties').doc(r.propertyId).get() : null;
    const settingsSnap = purpose === 'booking' ? await db.doc('settings/platform').get() : null;
    charge = buildCharge({
      purpose,
      r,
      property: propertySnap?.exists ? propertySnap.data() : null,
      settings: settingsSnap?.exists ? settingsSnap.data() : null,
      requestedDay: manilaDay(r.cancellationRequestedAt),
    });
  } catch (err) {
    if (err instanceof ChargeError) return json({ error: err.message }, err.status);
    console.error('[checkout] could not work out the amount:', err);
    return json({ error: 'Could not work out the amount to pay.' }, 500);
  }

  const origin = process.env.SITE_URL || request.headers.get('origin');
  if (!origin) return json({ error: 'Server is missing SITE_URL.' }, 500);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Stripe amounts are in centavos.
      line_items: charge.items.map((item) => ({
        quantity: 1,
        price_data: {
          currency: 'php',
          unit_amount: Math.round(item.pesos * 100),
          product_data: { name: item.name, ...(item.description ? { description: item.description } : {}) },
        },
      })),
      client_reference_id: reservationId,
      customer_email: r.guestEmail || undefined,
      metadata: { reservationId, guestId: user.uid, purpose },
      // {CHECKOUT_SESSION_ID} is filled in by Stripe. The page uses it to confirm the payment
      // even if the webhook has not arrived yet (see /api/confirm-payment).
      success_url: `${origin}/my-bookings?payment=success&purpose=${purpose}&reservation=${reservationId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/my-bookings?payment=cancelled&purpose=${purpose}`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Stripe refused the session:', err?.message);
    return json({ error: err?.message || 'Could not start the payment.' }, 502);
  }
}