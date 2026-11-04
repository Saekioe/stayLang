// POST /api/refund-reservation   body: { reservationId }
// Gives a full refund for a cancelled booking that was paid. The guest or the host can ask.
import { FieldValue, db, json, notification, requireUser, stripe } from '../server/shared.js';

export async function POST(request) {
  const user = await requireUser(request);
  if (!user) return json({ error: 'Please log in again.' }, 401);

  const { reservationId } = await request.json().catch(() => ({}));
  if (!reservationId) return json({ error: 'Missing reservation.' }, 400);

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) return json({ error: 'Booking not found.' }, 404);
  const r = { id: snap.id, ...snap.data() };

  if (r.guestId !== user.uid && r.ownerId !== user.uid) return json({ error: 'Not allowed.' }, 403);
  if (r.status !== 'cancelled') return json({ error: 'Only cancelled bookings can be refunded.' }, 409);
  if (r.paymentStatus === 'refunded') return json({ ok: true });
  if (r.paymentStatus !== 'paid' || !r.stripePaymentIntentId) return json({ error: 'There is no payment to refund.' }, 409);

  try {
    await stripe.refunds.create(
      { payment_intent: r.stripePaymentIntentId, metadata: { reservationId } },
      { idempotencyKey: `refund-${reservationId}` }
    );
  } catch (err) {
    return json({ error: err?.message || 'Stripe could not refund this payment.' }, 502);
  }

  const batch = db.batch();
  batch.update(ref, { paymentStatus: 'refunded', refundedAt: FieldValue.serverTimestamp() });
  batch.set(db.collection('notifications').doc(), notification(r, r.guestId, 'payment_refunded'));
  await batch.commit();
  return json({ ok: true });
}