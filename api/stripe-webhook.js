// POST /api/stripe-webhook   (called by Stripe, not by the browser)
// When Stripe says a Checkout payment succeeded, mark the reservation as paid.
import { db, json, stripe } from '../server/shared.js';
import { markPaid } from '../server/payments.js';

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
  } catch (err) {
    console.error('[webhook] signature check failed. STRIPE_WEBHOOK_SECRET must match the whsec_ printed by "stripe listen":', err.message);
    return json({ error: 'Invalid signature.' }, 400);
  }

  console.log(`[webhook] ${event.type}`);
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
  } catch (err) {
    console.error(`[webhook] could not process ${event.type}:`, err);
    return json({ error: 'Could not process the event.' }, 500); // Stripe will retry
  }
  return json({ received: true });
}
