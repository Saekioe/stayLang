// Admin-side cleanup when a listing or an account is removed.
//
// A removal is planned first (what will be deleted, what blocks it) and then run in small
// batches. The main document is always the LAST thing deleted, so if a run stops half way the
// admin can simply run it again.
//
// What it does NOT touch: reservations (history, the rules forbid deleting them) and the
// person's sign-in account (it needs the Admin SDK). A removed person who signs in again is
// told "This account no longer exists".
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const todayManila = () => new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);

const docsWhere = async (name, field, value) =>
  (await getDocs(query(collection(db, name), where(field, '==', value)))).docs;

const unique = (refs) => {
  const seen = new Set();
  return refs.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
};

const countIn = (refs, collectionName) => refs.filter((r) => r.parent.id === collectionName).length;

// One listing: its reviews, its booked and blocked nights, the private proof document, then the listing.
export async function planPropertyRemoval(propertyId) {
  const [reviews, nights] = await Promise.all([
    docsWhere('reviews', 'propertyId', propertyId),
    docsWhere('bookedNights', 'propertyId', propertyId),
  ]);
  const refs = unique([
    ...reviews.map((d) => d.ref),
    ...nights.map((d) => d.ref),
    doc(db, 'propertyDocs', propertyId),
    doc(db, 'properties', propertyId),
  ]);
  return {
    refs,
    blockers: [],
    counts: { listings: 1, reviews: countIn(refs, 'reviews'), nights: countIn(refs, 'bookedNights') },
  };
}

// One account: host application, every listing they own (with the leftovers above),
// the reviews they wrote, their username, then the profile.
// Active bookings block it, because cancelling paid stays needs a refund decision first.
export async function planUserRemoval(user) {
  const uid = user.id;
  const [asGuest, asHost, owned, written] = await Promise.all([
    docsWhere('reservations', 'guestId', uid),
    docsWhere('reservations', 'ownerId', uid),
    docsWhere('properties', 'ownerId', uid),
    docsWhere('reviews', 'guestId', uid),
  ]);

  const today = todayManila();
  const activeIds = new Set(
    [...asGuest, ...asHost]
      .filter((d) => {
        const r = d.data();
        return ['pending', 'confirmed'].includes(r.status) && (r.checkOut ?? '') >= today;
      })
      .map((d) => d.id)
  );

  const listings = await Promise.all(owned.map((d) => planPropertyRemoval(d.id)));

  const refs = unique([
    doc(db, 'hostApplications', uid),
    ...listings.flatMap((l) => l.refs),
    ...written.map((d) => d.ref),
    ...(user.username ? [doc(db, 'usernames', user.username.toLowerCase())] : []),
    doc(db, 'users', uid), // last
  ]);

  return {
    refs,
    blockers: activeIds.size
      ? [`${activeIds.size} active booking${activeIds.size === 1 ? '' : 's'} (pending or confirmed). Cancel or refund them in Reservation Monitoring first.`]
      : [],
    counts: {
      listings: owned.length,
      reviews: countIn(refs, 'reviews'),
      nights: countIn(refs, 'bookedNights'),
    },
  };
}

// Deletes in batches well under Firestore's 500-write limit.
export async function runRemoval(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

export const describeCounts = ({ listings = 0, reviews = 0, nights = 0 }) => {
  const parts = [];
  if (listings) parts.push(`${listings} listing${listings === 1 ? '' : 's'}`);
  if (reviews) parts.push(`${reviews} review${reviews === 1 ? '' : 's'}`);
  if (nights) parts.push(`${nights} booked or blocked night${nights === 1 ? '' : 's'}`);
  return parts;
};
