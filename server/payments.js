// Marks payments as paid. Used by the Stripe webhook and by /api/confirm-payment, so a
// missed webhook never leaves a paid booking stuck as "unpaid".
// A Checkout session carries metadata.purpose: booking, cancellation or damage.
import { FieldValue, db, notification, stripe } from './shared.js';

// Which fields on the reservation each kind of payment updates.
export const FIELDS = {
  booking: { status: 'paymentStatus', paidAt: 'paidAt', intent: 'stripePaymentIntentId', session: 'stripeSessionId' },
  cancellation: { status: 'cancellationFeeStatus', paidAt: 'cancellationFeePaidAt', intent: 'cancellationFeeIntentId', session: 'cancellationFeeSessionId' },
  damage: { status: 'damageStatus', paidAt: 'damagePaidAt', intent: 'damageIntentId', session: 'damageSessionId' },
};

const purposeOf = (session) => session.metadata?.purpose || 'booking';

// Returns 'paid', 'refunded' or 'unpaid'. Safe to call many times for the same session.
export async function markPaid(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  const purpose = purposeOf(session);
  const f = FIELDS[purpose];
  if (!f) {
    console.log(`[payments] ${sessionId} has an unknown purpose "${purpose}"`);
    return 'unpaid';
  }
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
  const current = r[f.status];
  if (current === 'paid' || current === 'refunded') {
    console.log(`[payments] ${purpose} payment for ${reservationId} is already ${current}`);
    return current;
  }

  const amount = (session.amount_total ?? 0) / 100;
  const intent = session.payment_intent;
  const common = {
    [f.status]: 'paid',
    [f.paidAt]: FieldValue.serverTimestamp(),
    [f.intent]: intent?.id ?? null,
    [f.session]: session.id,
  };
  const notes = db.collection('notifications');

  if (purpose === 'booking') {
    const details = intent?.latest_charge?.payment_method_details;
    const bookingFields = {
      paymentMethod: details?.type ?? 'card',
      paymentBrand: details?.card?.brand ?? null,
      paymentLast4: details?.card?.last4 ?? null,
      amountPaid: amount,
    };
    // The booking was cancelled while the guest was paying: give the money back.
    if (r.status !== 'confirmed') {
      if (intent?.id) {
        await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${reservationId}` });
      }
      await ref.update({ ...common, ...bookingFields, [f.status]: 'refunded', refundedAt: FieldValue.serverTimestamp() });
      console.log(`[payments] reservation ${reservationId} was ${r.status}, so the payment was refunded`);
      return 'refunded';
    }
    const batch = db.batch();
    batch.update(ref, { ...common, ...bookingFields });
    batch.set(notes.doc(), notification(r, r.guestId, 'payment_confirmed'));
    batch.set(notes.doc(), notification(r, r.ownerId, 'payment_received'));
    await batch.commit();
  } else {
    // cancellation fee or damage charge: record it and tell both sides
    const type = purpose === 'cancellation' ? 'cancellation_fee_paid' : 'damage_paid';
    const batch = db.batch();
    batch.update(ref, common);
    batch.set(notes.doc(), notification(r, r.guestId, type, { amount }));
    batch.set(notes.doc(), notification(r, r.ownerId, type, { amount }));
    await batch.commit();
  }
  console.log(`[payments] ${purpose} payment for ${reservationId} marked paid`);
  return 'paid';
}

// Looks through recent Checkout sessions for a paid one for this reservation and purpose.
export async function findPaidSessionId(reservationId, purpose = 'booking') {
  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const match = sessions.data.find(
    (s) => s.client_reference_id === reservationId && purposeOf(s) === purpose && s.payment_status === 'paid'
  );
  return match?.id ?? null;
}