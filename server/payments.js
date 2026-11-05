// Marks reservations as paid. Used by the Stripe webhook and by /api/confirm-payment,
// so a missed webhook never leaves a paid booking stuck as "unpaid".
import { FieldValue, db, notification, stripe } from './shared.js';

// Returns 'paid', 'refunded' or 'unpaid'. Safe to call many times for the same session.
export async function markPaid(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  if (session.payment_status !== 'paid') {
    console.log(`[payments] ${sessionId} is not paid yet (${session.payment_status})`);
    return 'unpaid';
  }

  const reservationId = session.client_reference_id;
  if (!reservationId) {
    console.log(`[payments] ${sessionId} has no reservation id`);
    return 'unpaid';
  }
  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`[payments] reservation ${reservationId} not found`);
    return 'unpaid';
  }
  const r = { id: snap.id, ...snap.data() };
  if (r.paymentStatus === 'paid' || r.paymentStatus === 'refunded') {
    console.log(`[payments] reservation ${reservationId} already ${r.paymentStatus}`);
    return r.paymentStatus;
  }

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
    console.log(`[payments] reservation ${reservationId} was ${r.status}, so the payment was refunded`);
    return 'refunded';
  }

  const batch = db.batch();
  batch.update(ref, { ...paidFields, paymentStatus: 'paid', paidAt: FieldValue.serverTimestamp() });
  batch.set(db.collection('notifications').doc(), notification(r, r.guestId, 'payment_confirmed'));
  batch.set(db.collection('notifications').doc(), notification(r, r.ownerId, 'payment_received'));
  await batch.commit();
  console.log(`[payments] reservation ${reservationId} marked paid`);
  return 'paid';
}

// Looks through recent Checkout sessions for a paid one that belongs to this reservation.
export async function findPaidSessionId(reservationId) {
  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const match = sessions.data.find(
    (s) => s.client_reference_id === reservationId && s.payment_status === 'paid'
  );
  return match?.id ?? null;
}
