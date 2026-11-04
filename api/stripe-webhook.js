// POST /api/stripe-webhook   (called by Stripe, not by the browser)
// When Stripe says a Checkout payment succeeded, mark the reservation as paid.
import { FieldValue, db, json, notification, stripe } from '../server/shared.js';

async function markPaid(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  if (session.payment_status !== 'paid') return;

  const reservationId = session.client_reference_id;
  if (!reservationId) return;
  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const r = { id: snap.id, ...snap.data() };
  if (r.paymentStatus === 'paid' || r.paymentStatus === 'refunded') return; // Stripe may resend events

  const intent = session.payment_intent;
  const details = intent?.latest_charge?.payment_method_details;
  const paidFields = {
    paymentMethod: details?.type ?? 'card',
    paymentBrand: details?.card?.brand ?? null,
    paymentLast4: details?.card?.last4 ?? null,
    stripeSessionId: session.id,
    stripePaymentIntentId: intent?.id ?? null,
    amountPaid: (session.amount_total ?? 0) / 100,
  };

  // The booking was cancelled while the guest was paying: give the money back.
  if (r.status !== 'confirmed') {
    if (intent?.id) {
      await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${reservationId}` });
    }
    await ref.update({ ...paidFields, paymentStatus: 'refunded', refundedAt: FieldValue.serverTimestamp() });
    return;
  }

  const batch = db.batch();
  batch.update(ref, { ...paidFields, paymentStatus: 'paid', paidAt: FieldValue.serverTimestamp() });
  batch.set(db.collection('notifications').doc(), notification(r, r.guestId, 'payment_confirmed'));
  batch.set(db.collection('notifications').doc(), notification(r, r.ownerId, 'payment_received'));
  await batch.commit();
}

async function markFailed(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session.client_reference_id) return;
  const ref = db.collection('reservations').doc(session.client_reference_id);
  const snap = await ref.get();
  if (snap.exists && (snap.data().paymentStatus ?? 'unpaid') === 'unpaid') {
    await ref.update({ paymentStatus: 'failed' });
  }
}

export async function POST(request) {
  const raw = await request.text(); // the exact bytes Stripe signed
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return json({ error: 'Invalid signature.' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await markPaid(event.data.object.id);
        break;
      case 'checkout.session.async_payment_failed':
        await markFailed(event.data.object.id);
        break;
      default:
        break;
    }
  } catch {
    return json({ error: 'Could not process the event.' }, 500); // Stripe will retry
  }
  return json({ received: true });
}