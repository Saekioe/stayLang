import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Rating, TextField, Typography,
} from '@mui/material';
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Auth';
import NavigationBar from '../components/NavigationBar';

// Set to true to let guests review only after their check-out date has passed.
const ONLY_AFTER_CHECKOUT = false;

const ui = {
  muted: '#7A7070',
  line: '#E6E3E3',
  butter: '#FBF1C0',
  butterTint: '#FFFBE8',
  sage: '#DFEEDF',
  sageText: '#2E6B3F',
};

const statusInfo = {
  pending: { label: 'Waiting for the host', sx: { bgcolor: ui.butter, color: '#6B5200' } },
  confirmed: { label: 'Confirmed', sx: { bgcolor: ui.sage, color: ui.sageText } },
  declined: { label: 'Declined', sx: { bgcolor: '#EFECEC', color: ui.muted } },
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmt = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function MyBookings() {
  const { user, profile, loading } = useAuth();
  const uid = user?.uid;
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState({}); // keyed by reservation id
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

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
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
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

  if (loading) {
    return <Box sx={{ py: 12, textAlign: 'center', bgcolor: '#fff', minHeight: '100vh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;

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

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
      <NavigationBar />
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12, textAlign: 'left' }}>
        <Typography component="h1" sx={{ color: 'black', fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.1 }}>
          My bookings
        </Typography>
        <Typography sx={{ color: ui.muted, mt: 1, mb: 3 }}>
          Your booking requests, what the host decided, and your reviews.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper elevation={0} sx={{ bgcolor: '#fff', border: `1px solid ${ui.line}`, borderRadius: '16px', overflow: 'hidden' }}>
          {!ready ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : bookings.length === 0 ? (
            <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>No bookings yet</Typography>
              <Typography sx={{ color: ui.muted, maxWidth: 420, mx: 'auto', mb: 3 }}>
                When you request a place, it will show up here with its status.
              </Typography>
              <Button variant="contained" component={RouterLink} to="/places">Find places</Button>
            </Box>
          ) : (
            bookings.map((b) => {
              const info = statusInfo[b.status] ?? statusInfo.pending;
              const review = reviews[b.id];
              return (
                <Box
                  key={b.id}
                  sx={{
                    p: 2,
                    borderTop: `1px solid ${ui.line}`,
                    '&:first-of-type': { borderTop: 0 },
                    bgcolor: b.status === 'pending' ? ui.butterTint : 'transparent',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{b.propertyTitle}</Typography>
                      <Typography variant="body2" sx={{ color: ui.muted }}>
                        {fmt(b.checkIn)} to {fmt(b.checkOut)}, {plural(b.nights ?? 0, 'night')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: ui.muted }}>
                        {plural(b.guests ?? 1, 'guest')}, ${b.total} total
                      </Typography>
                    </Box>
                    <Chip label={info.label} sx={{ fontWeight: 600, ...info.sx }} />
                  </Box>

                  {b.status === 'confirmed' && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${ui.line}` }}>
                      {review ? (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: ui.muted, fontWeight: 600 }}>Your review</Typography>
                            <Rating value={review.rating} readOnly size="small" />
                            {review.text && <Typography variant="body2" sx={{ mt: 0.25 }}>{review.text}</Typography>}
                          </Box>
                          <Button size="small" onClick={() => openReview(b)}>Edit review</Button>
                        </Box>
                      ) : canReview(b) ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ color: ui.muted }}>
                            How was your stay? Your review helps other guests.
                          </Typography>
                          <Button size="small" variant="outlined" onClick={() => openReview(b)}>Write a review</Button>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: ui.muted }}>
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

      <Dialog open={Boolean(reviewing)} onClose={closeReview} fullWidth maxWidth="sm" aria-labelledby="review-title">
        <DialogTitle id="review-title" sx={{ textAlign: 'left' }}>
          {reviewing && reviews[reviewing.id] ? 'Edit your review' : 'Write a review'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'left' }}>
          {reviewing && (
            <Typography variant="body2" sx={{ color: ui.muted, mb: 2 }}>
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
          <Typography variant="caption" sx={{ color: ui.muted, display: 'block', mt: 0.5 }}>
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