// Shared setup for the Vercel functions in /api.
// Runs only on the server. The Stripe secret key and the Firebase service account
// come from environment variables and must never be placed in the React code.
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

if (!getApps().length) {
  // Locally: FIREBASE_SERVICE_ACCOUNT_FILE points to the downloaded .json file.
  // On a host: FIREBASE_SERVICE_ACCOUNT holds the file's contents.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8');
  initializeApp({ credential: cert(JSON.parse(raw)) });
}

export const db = getFirestore();
export const adminAuth = getAuth();
export { FieldValue };
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const json = (body, status = 200) => Response.json(body, { status });

// Returns the verified Firebase user for "Authorization: Bearer <ID token>", or null.
export async function requireUser(request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

// Today as YYYY-MM-DD in Philippine time (UTC+8), matching the dates guests pick.
export const todayInManila = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

export const nightsCount = (checkIn, checkOut) => {
  const [y, m, d] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86400000);
};

// A message for someone's inbox (the browser rules do not apply to the server).
export const notification = (r, userId, type, extra = {}) => ({
  userId,
  reservationId: r.id,
  type,
  propertyTitle: r.propertyTitle,
  checkIn: r.checkIn,
  checkOut: r.checkOut,
  nights: r.nights ?? 0,
  total: r.total ?? 0,
  read: false,
  createdAt: FieldValue.serverTimestamp(),
  ...extra,
});