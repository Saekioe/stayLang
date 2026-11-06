// POST /api/confirm-payment   body: { reservationId, purpose }
// Asks Stripe directly whether this payment was made, and updates the booking if so.
// The webhook normally does this; this is the backup for when the webhook did not arrive.
import { db, json, requireUser } from '../server/shared.js';
import { FIELDS, findPaidSessionId, markPaid } from '../server/payments.js';

export async function POST(request) {
  const user = await requireUser(request);
  if (!user) return json({ error: 'Please log in again.' }, 401);

  const { reservationId, purpose = 'booking' } = await request.json().catch(() => ({}));
  if (!reservationId) return json({ error: 'Missing reservation.' }, 400);
  if (!FIELDS[purpose]) return json({ error: 'Unknown payment type.' }, 400);

  const snap = await db.collection('reservations').doc(reservationId).get();
  if (!snap.exists) return json({ error: 'Booking not found.' }, 404);
  const r = snap.data();
  if (r.guestId !== user.uid) return json({ error: 'This is not your booking.' }, 403);

  const current = r[FIELDS[purpose].status];
  if (current === 'paid' || current === 'refunded') return json({ status: current });

  try {
    const sessionId = await findPaidSessionId(reservationId, purpose);
    if (!sessionId) return json({ status: 'unpaid' });
    return json({ status: await markPaid(sessionId) });
  } catch (err) {
    console.error('[confirm-payment] failed:', err);
    return json({ error: 'Could not check the payment with Stripe.' }, 502);
  }
}