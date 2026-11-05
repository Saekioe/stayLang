import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Paper, Rating, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import NavigationBar from '../components/NavigationBar';
import {
  PAYMENT_LABELS, cancelReservation, money, paymentMethodLabel, paymentStatusOf, refundReservation, startCheckout, statusOf, todayISO,
} from '../dataqueries/Booking';

// Set to true to let guests review only after their check-out date has passed.
const ONLY_AFTER_CHECKOUT = true;

const statusInfo = {
  pending: { label: 'Waiting for the host', sx: { bgcolor: '#FBF1C0', color: '#6B5200' } },
  confirmed: { label: 'Confirmed', sx: { bgcolor: '#DFEEDF', color: '#2E6B3F' } },
  completed: { label: 'Completed', sx: { bgcolor: '#E3EAF7', color: '#27437A' } },
  declined: { label: 'Declined', sx: { bgcolor: '#EFECEC', color: '#7A7070' } },
  cancelled: { label: 'Cancelled', sx: { bgcolor: '#F8E1DF', color: '#8A2E26' } },
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const fmt = (d) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

const fmtStamp = (ts) =>
  ts?.toDate
    ? ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

const surfaceSx = {
  bgcolor: '#ffffff',
  border: '1px solid #E6E3E3',
  borderRadius: '16px',
  overflow: 'hidden',
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'closed', label: 'Cancelled or declined' },
];

// Which tab a reservation belongs to.
const tabOf = (b) => {
  const s = statusOf(b);
  if (s === 'completed') return 'past';
  if (s === 'cancelled' || s === 'declined') return 'closed';
  return 'upcoming'; // pending, or confirmed and not finished yet
};

function Line({ label, value, bold }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography variant="body2" sx={{ color: '#7A7070' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

function SummaryCard({ label, value }) {
  return (
    <Paper elevation={0} sx={{ ...surfaceSx, p: 2 }}>
      <Typography variant="body2" sx={{ color: '#7A7070', fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
    </Paper>
  );
}

export default function MyBookings() {
  const { user, profile, loading } = useAuth();
  const uid = user?.uid;
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState({}); // keyed by reservation id
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [payingId, setPayingId] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentResult = searchParams.get('payment'); // set by Stripe when the guest comes back

  // history filter and details dialog
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);

  // review dialog
  const [reviewing, setReviewing] = useState(null);
  const [form, setForm] = useState({ rating: 0, text: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubBookings = onSnapshot(
      query(collection(db, 'reservations'), where('guestId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Newest check-in first, so the history reads from most recent to oldest.
        list.sort((a, b) => (b.checkIn ?? '').localeCompare(a.checkIn ?? ''));
        setBookings(list);
        setReady(true);
      },
      () => {
        setError('We could not load your bookings. Check your connection and that the latest Firestore rules are published.');
        setReady(true);
      }
    );
    // One review per booking: the review's id is the booking's id.
    const unsubReviews = onSnapshot(
      query(collection(db, 'reviews'), where('guestId', '==', uid)),
      (snap) => setReviews(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
      () => {}
    );
    return () => {
      unsubBookings();
      unsubReviews();
    };
  }, [uid]);

  const counts = useMemo(() => {
    const c = { all: bookings.length, upcoming: 0, past: 0, closed: 0 };
    bookings.forEach((b) => { c[tabOf(b)] += 1; });
    return c;
  }, [bookings]);

  const spent = useMemo(
    () => bookings.filter((b) => statusOf(b) === 'completed').reduce((sum, b) => sum + (b.total ?? 0), 0),
    [bookings]
  );

  if (loading) {
    return <Box sx={{ py: 12, textAlign: 'center', bgcolor: '#fff', minHeight: '100vh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const shown = tab === 'all' ? bookings : bookings.filter((b) => tabOf(b) === tab);

  // A guest can cancel a pending or confirmed booking until the day of check-in.
  const canCancel = (b) => (b.status === 'pending' || b.status === 'confirmed') && b.checkIn > todayISO();

  const guestSummary = (b) => {
  const adults = b.adults ?? b.guests ?? 1;
  const parts = [plural(adults, 'adult')];
  if (b.children) parts.push(`${b.children} ${b.children === 1 ? 'child' : 'children'}`);
  if (b.infants) parts.push(plural(b.infants, 'infant'));
  if (b.pets) parts.push(plural(b.pets, 'pet'));
  return parts.join(', ');
};

  const cancelBooking = async (b) => {
    if (!window.confirm(`Cancel your booking at "${b.propertyTitle}"?${paymentStatusOf(b) === 'paid' ? ' You will get a full refund.' : ''}`)) return;
    setError('');
    setCancellingId(b.id);
    try {
      await cancelReservation(b, 'guest');
    } catch {
      setError('We could not cancel that booking. Please try again.');
      setCancellingId('');
      return;
    }
    if (paymentStatusOf(b) === 'paid') {
      try {
        await refundReservation(b);
      } catch {
        setError('Your booking was cancelled, but the refund could not be processed yet. Use "Retry refund" on the booking.');
      }
    }
    setCancellingId('');
  };

  const payNow = async (b) => {
    setError('');
    setPayingId(b.id);
    try {
      await startCheckout(b); // leaves this page for Stripe
    } catch (err) {
      setError(err.message);
      setPayingId('');
    }
  };

  const retryRefund = async (b) => {
    setError('');
    setPayingId(b.id);
    try {
      await refundReservation(b);
    } catch (err) {
      setError(err.message);
    } finally {
      setPayingId('');
    }
  };

  const canReview = (b) =>
    b.status === 'confirmed' && (!ONLY_AFTER_CHECKOUT || b.checkOut <= todayISO());

  const openReview = (b) => {
    const existing = reviews[b.id];
    setForm({ rating: existing?.rating ?? 0, text: existing?.text ?? '' });
    setFormError('');
    setReviewing(b);
  };

  const closeReview = () => {
    if (!saving) setReviewing(null);
  };

  // Public name on the review: first name and last initial.
  const publicName = profile
    ? `${profile.firstName} ${profile.lastName?.charAt(0) ?? ''}.`.replace(/ \.$/, '')
    : user.displayName || 'Guest';

  const saveReview = async () => {
    if (!form.rating) return setFormError('Choose a star rating.');
    setFormError('');
    setSaving(true);
    const ref = doc(db, 'reviews', reviewing.id);
    try {
      if (reviews[reviewing.id]) {
        await updateDoc(ref, { rating: form.rating, text: form.text.trim(), updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, {
          reservationId: reviewing.id,
          propertyId: reviewing.propertyId,
          propertyTitle: reviewing.propertyTitle,
          ownerId: reviewing.ownerId,
          guestId: user.uid,
          guestName: publicName,
          rating: form.rating,
          text: form.text.trim(),
          createdAt: serverTimestamp(),
        });
      }
      setReviewing(null);
    } catch {
      setFormError('Could not save your review. Make sure the latest Firestore rules are published.');
    } finally {
      setSaving(false);
    }
  };

  const deleteReview = async () => {
    if (!window.confirm('Delete your review?')) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'reviews', reviewing.id));
      setReviewing(null);
    } catch {
      setFormError('Could not delete your review.');
    } finally {
      setSaving(false);
    }
  };

  // Details dialog: use the live copy so it updates if the host changes the status while it is open.
  const current = selected ? bookings.find((b) => b.id === selected.id) ?? selected : null;
  const currentInfo = current ? statusInfo[statusOf(current)] ?? statusInfo.pending : null;
  const cleaning = current?.cleaningFee ?? 0;
  const service = current?.serviceFee ?? 0;
  const roomTotal = current ? (current.total ?? 0) - cleaning - service : 0;
  const perNight = current?.nights ? roomTotal / current.nights : 0;

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
      <NavigationBar />
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12, textAlign: 'left' }}>
        <Typography component="h1" sx={{ color: 'black', fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.1 }}>
          My Reservations
        </Typography>
        <Typography sx={{ color: '#7A7070', mt: 1, mb: 3 }}>
          View reservation history and details, and leave reviews for your stays.
        </Typography>

        {paymentResult === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSearchParams({}, { replace: true })}>
            Thank you! Your payment went through. It can take a few seconds to show as Paid.
          </Alert>
        )}
        {paymentResult === 'cancelled' && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setSearchParams({}, { replace: true })}>
            Payment was cancelled. You have not been charged. You can pay again at any time.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <SummaryCard label="All reservations" value={counts.all} />
          <SummaryCard label="Upcoming" value={counts.upcoming} />
          <SummaryCard label="Past stays" value={counts.past} />
          <SummaryCard label="Total spent" value={money(spent)} />
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 2,
            borderBottom: '1px solid #E6E3E3',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '1rem' },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={`${t.label} (${counts[t.key]})`} />
          ))}
        </Tabs>

        <Paper elevation={0} sx={surfaceSx}>
          {!ready ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : shown.length === 0 ? (
            <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>
                {bookings.length === 0 ? 'No reservations yet' : 'Nothing in this list'}
              </Typography>
              <Typography sx={{ color: '#7A7070', maxWidth: 420, mx: 'auto', mb: 3 }}>
                {bookings.length === 0
                  ? 'When you request a place, it will show up here with its status.'
                  : 'Try another tab to see your other reservations.'}
              </Typography>
              {bookings.length === 0 && (
                <Button variant="contained" component={RouterLink} to="/places">Find places</Button>
              )}
            </Box>
          ) : (
            shown.map((b) => {
              const info = statusInfo[statusOf(b)] ?? statusInfo.pending;
              const review = reviews[b.id];
              return (
                <Box
                  key={b.id}
                  sx={{
                    p: 2,
                    borderTop: '1px solid #E6E3E3',
                    '&:first-of-type': { borderTop: 0 },
                    bgcolor: b.status === 'pending' ? '#FFFBE8' : 'transparent',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{b.propertyTitle}</Typography>
                      <Typography variant="body2" sx={{ color: '#7A7070' }}>
                        {fmt(b.checkIn)} to {fmt(b.checkOut)}, {plural(b.nights ?? 0, 'night')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#7A7070' }}>
                        {guestSummary(b)}, {money(b.total)} total
                      </Typography>
                      {b.status === 'cancelled' && (
                        <Typography variant="body2" sx={{ color: '#8A2E26', mt: 0.5 }}>
                          Cancelled by {b.cancelledBy === 'host' ? 'the host' : 'you'}.
                        </Typography>
                      )}
                      {b.status === 'confirmed' && (
                        <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: paymentStatusOf(b) === 'paid' ? '#2E6B3F' : '#6B5200' }}>
                          Payment: {PAYMENT_LABELS[paymentStatusOf(b)]}
                          {paymentStatusOf(b) === 'paid' && paymentMethodLabel(b) ? ` (${paymentMethodLabel(b)})` : ''}
                        </Typography>
                      )}
                      {b.status === 'cancelled' && paymentStatusOf(b) === 'refunded' && (
                        <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: '#2E6B3F' }}>
                          Your payment was refunded.
                        </Typography>
                      )}
                      {b.status === 'cancelled' && paymentStatusOf(b) === 'paid' && (
                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#6B5200' }}>Refund pending.</Typography>
                          <Button size="small" disabled={payingId === b.id} onClick={() => retryRefund(b)}>Retry refund</Button>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={info.label} sx={{ fontWeight: 600, ...info.sx }} />
                      <Button size="small" variant="outlined" onClick={() => setSelected(b)}>
                        View details
                      </Button>
                      {canCancel(b) && (
                        <Button size="small" color="inherit" disabled={cancellingId === b.id} onClick={() => cancelBooking(b)}>
                          {cancellingId === b.id ? 'Cancelling…' : 'Cancel booking'}
                        </Button>
                      )}
                      {b.status === 'confirmed' && paymentStatusOf(b) !== 'paid' && b.checkOut >= todayISO() && (
                        <Button size="small" variant="contained" disableElevation disabled={payingId === b.id} onClick={() => payNow(b)}>
                          {payingId === b.id ? 'Opening…' : 'Pay now'}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {b.status === 'confirmed' && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #E6E3E3' }}>
                      {review ? (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: '#7A7070', fontWeight: 600 }}>Your review</Typography>
                            <Rating value={review.rating} readOnly size="small" />
                            {review.text && <Typography variant="body2" sx={{ mt: 0.25 }}>{review.text}</Typography>}
                            {review.hostReply && (
                              <Typography variant="body2" sx={{ mt: 0.5, color: '#2F5E70' }}>
                                Host reply: {review.hostReply}
                              </Typography>
                            )}
                          </Box>
                          <Button size="small" onClick={() => openReview(b)}>Edit review</Button>
                        </Box>
                      ) : canReview(b) ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ color: '#7A7070' }}>
                            How was your stay? Your review helps other guests.
                          </Typography>
                          <Button size="small" variant="outlined" onClick={() => openReview(b)}>Write a review</Button>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#7A7070' }}>
                          You can review this place after your stay ends on {fmt(b.checkOut)}.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Paper>
      </Box>

      {/* Reservation details */}
      <Dialog open={Boolean(current)} onClose={() => setSelected(null)} fullWidth maxWidth="sm" aria-labelledby="res-title">
        {current && (
          <>
            <DialogTitle id="res-title" sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <span>Reservation details</span>
                <Chip label={currentInfo.label} sx={{ fontWeight: 600, ...currentInfo.sx }} />
              </Box>
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>{current.propertyTitle}</Typography>

              <Line label="Check-in" value={fmt(current.checkIn)} />
              <Line label="Check-out" value={fmt(current.checkOut)} />
              <Line label="Nights" value={current.nights ?? 0} />
              <Line label="Guests" value={guestSummary(current)} />

              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Price</Typography>
              <Line
                label={current.nights ? `${money(perNight)} x ${plural(current.nights, 'night')}` : 'Stay'}
                value={money(roomTotal)}
              />
              {cleaning > 0 && <Line label="Cleaning fee" value={money(cleaning)} />}
              {service > 0 && <Line label="Service fee" value={money(service)} />}
              <Line label="Total" value={money(current.total)} bold />
              {(current.status === 'confirmed' || paymentStatusOf(current) !== 'unpaid') && (
                <Line
                  label="Payment"
                  value={`${PAYMENT_LABELS[paymentStatusOf(current)]}${
                    paymentStatusOf(current) === 'paid' && paymentMethodLabel(current) ? ` (${paymentMethodLabel(current)})` : ''
                  }`}
                />
              )}

              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Booking info</Typography>
              {fmtStamp(current.createdAt) && <Line label="Requested on" value={fmtStamp(current.createdAt)} />}
              {current.guestName && <Line label="Booked under" value={current.guestName} />}
              {current.guestEmail && <Line label="Email" value={current.guestEmail} />}
              {current.guestPhone && <Line label="Phone" value={current.guestPhone} />}
              <Line label="Reservation ID" value={current.id} />

              {current.status === 'cancelled' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Cancelled by {current.cancelledBy === 'host' ? 'the host' : 'you'}
                  {fmtStamp(current.cancelledAt) ? ` on ${fmtStamp(current.cancelledAt)}` : ''}.
                </Alert>
              )}
              {current.status === 'declined' && (
                <Alert severity="info" sx={{ mt: 2 }}>The host declined this request.</Alert>
              )}
              {current.status === 'pending' && (
                <Alert severity="warning" sx={{ mt: 2 }}>Waiting for the host to confirm your request.</Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button variant="contained" onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Review dialog */}
      <Dialog open={Boolean(reviewing)} onClose={closeReview} fullWidth maxWidth="sm" aria-labelledby="review-title">
        <DialogTitle id="review-title" sx={{ textAlign: 'left' }}>
          {reviewing && reviews[reviewing.id] ? 'Edit your review' : 'Write a review'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'left' }}>
          {reviewing && (
            <Typography variant="body2" sx={{ color: '#7A7070', mb: 2 }}>
              {reviewing.propertyTitle}, {fmt(reviewing.checkIn)} to {fmt(reviewing.checkOut)}
            </Typography>
          )}
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>Your rating</Typography>
          <Rating
            value={form.rating}
            onChange={(_, value) => setForm((f) => ({ ...f, rating: value ?? 0 }))}
            size="large"
            precision={1}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Your review (optional)"
            value={form.text}
            onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <Typography variant="caption" sx={{ color: '#7A7070', display: 'block', mt: 0.5 }}>
            Shown publicly as {publicName}.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {reviewing && reviews[reviewing.id] && (
            <Button color="inherit" onClick={deleteReview} disabled={saving} sx={{ mr: 'auto' }}>
              Delete
            </Button>
          )}
          <Button color="inherit" onClick={closeReview} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveReview} disabled={saving}>
            {saving ? 'Saving…' : 'Save review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}