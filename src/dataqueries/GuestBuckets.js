import { statusOf } from './Booking';
import { todayISO } from './Pricing';

// The one place that decides which guest list a reservation belongs to.
//   incoming = pending requests waiting for the host (nothing else)
//   current  = confirmed and not finished yet (staying now, or arriving later)
//   archived = completed, declined or cancelled
export const GUEST_TABS = [
  { key: 'incoming', label: 'Incoming guests' },
  { key: 'current', label: 'Current guests' },
  { key: 'archived', label: 'Archived guests' },
];

export function bucketOf(r) {
  const s = statusOf(r);
  if (s === 'pending') return 'incoming';
  if (s === 'confirmed') return 'current';
  return 'archived'; // completed, declined, cancelled, anything else
}

// Inside "current": has the guest arrived yet?
export const stageOf = (r, today = todayISO()) => (r.checkIn <= today ? 'staying' : 'arriving');

export function countGuests(reservations) {
  const counts = { incoming: 0, current: 0, archived: 0 };
  reservations.forEach((r) => { counts[bucketOf(r)] += 1; });
  return counts;
}

// Search, property, stay/outcome and date range, all applied to one list.
export function filterGuests(list, { query = '', propertyId = 'all', stage = 'all', status = 'all', from = '', to = '' }) {
  const q = query.trim().toLowerCase();
  return list.filter((r) => {
    if (propertyId !== 'all' && r.propertyId !== propertyId) return false;
    if (stage !== 'all' && stageOf(r) !== stage) return false;
    if (status !== 'all' && statusOf(r) !== status) return false;
    if (from && (r.checkOut ?? '') < from) return false; // keep stays that overlap the range
    if (to && (r.checkIn ?? '') > to) return false;
    if (q) {
      const hay = [r.guestName, r.guestEmail, r.guestPhone, r.propertyTitle, r.id]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortGuests(list, bucket) {
  const byCheckIn = (a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? '');
  return [...list].sort(bucket === 'archived' ? (a, b) => byCheckIn(b, a) : byCheckIn);
}