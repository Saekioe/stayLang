import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Fade, IconButton, LinearProgress, Link, MenuItem, Paper, Rating,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import NavigationBar from '../components/NavigationBar';
import ListingForm from '../components/Listingform';
import AvailabilityCalendar from '../components/AvailabilityCalendar';

import HostApplication from '../components/HostApplication';
import { useHostApplication } from '../dataqueries/Host';
import { money } from '../dataqueries/Booking';
import { hostPayout, todayISO } from '../dataqueries/Pricing';
import IncomingGuests from '../components/IncomingGuests';


const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "2 adults, 1 child, 1 infant, 1 pet". Older reservations only have `guests`.
const guestSummary = (r) => {
  const adults = r.adults ?? r.guests ?? 1;
  const parts = [plural(adults, 'adult')];
  if (r.children) parts.push(`${r.children} ${r.children === 1 ? 'child' : 'children'}`);
  if (r.infants) parts.push(plural(r.infants, 'infant'));
  if (r.pets) parts.push(plural(r.pets, 'pet'));
  return parts.join(', ');
};

const fmt = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Dates are "YYYY-MM-DD" strings. dayNum turns one into a whole-day number so
// stays can be compared and overlapped without time zone surprises.
const pad = (n) => String(n).padStart(2, '0');
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

const surfaceSx = {
  bgcolor: '#ffffff',
  border: '1px solid #E6E3E3',
  borderRadius: '16px',
  overflow: 'hidden',
};

const rowSx = {
  p: 2,
  borderTop: '1px solid #E6E3E3',
  '&:first-of-type': { borderTop: 0 },
};

// ---------- dashboard numbers ----------
function computeStats(properties, reservations, reviews) {
  const today = dayNum(toISODate(new Date()));
  const confirmed = reservations.filter((r) => r.status === 'confirmed');
  const pending = reservations.filter((r) => r.status === 'pending');
  const declined = reservations.filter((r) => r.status === 'declined');

  const earnings = confirmed.reduce((sum, r) => sum + hostPayout(r), 0);
  const nights = confirmed.reduce((sum, r) => sum + (r.nights ?? 0), 0);
  const decided = confirmed.length + declined.length;
  const acceptance = decided ? Math.round((confirmed.length / decided) * 100) : null;

  // Earnings for the last 6 months, grouped by check-in month.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      total: 0,
    };
  });
  confirmed.forEach((r) => {
    const month = months.find((m) => m.key === r.checkIn?.slice(0, 7));
    if (month) month.total += hostPayout(r);
  });

  const upcoming = confirmed
    .filter((r) => r.checkOut && dayNum(r.checkOut) >= today)
    .sort((a, b) => dayNum(a.checkIn) - dayNum(b.checkIn));

  // Per property: requests, confirmed bookings, earnings, and how full the next 30 days are.
  const windowEnd = today + 30;
  const perProperty = properties.map((p) => {
    const mine = reservations.filter((r) => r.propertyId === p.id);
    const conf = mine.filter((r) => r.status === 'confirmed');
    const mineReviews = reviews.filter((rv) => rv.propertyId === p.id);
    const bookedNights = conf.reduce(
      (sum, r) => sum + Math.max(0, Math.min(dayNum(r.checkOut), windowEnd) - Math.max(dayNum(r.checkIn), today)),
      0
    );
    return {
      p,
      requests: mine.length,
      confirmed: conf.length,
      earnings: conf.reduce((sum, r) => sum + hostPayout(r), 0),
      occupancy: Math.min(100, Math.round((bookedNights / 30) * 100)),
      ratingCount: mineReviews.length,
      rating: mineReviews.length ? mineReviews.reduce((sum, rv) => sum + rv.rating, 0) / mineReviews.length : null,
    };
  });

  return { confirmed, pending, earnings, nights, acceptance, months, upcoming, perProperty };
}

function StatCard({ label, value, note, highlight }) {
  return (
    <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5, bgcolor: highlight ? '#FFFBE8' : '#fff' }}>
      <Typography variant="body2" sx={{ color: '#7A7070', fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
      <Typography variant="body2" sx={{ color: '#7A7070', mt: 0.25 }}>{note}</Typography>
    </Paper>
  );
}

function Dashboard({ properties, reservations, reviews }) {
  const s = useMemo(() => computeStats(properties, reservations, reviews), [properties, reservations, reviews]);
  const maxMonth = Math.max(...s.months.map((m) => m.total), 1);
  const hasEarnings = s.months.some((m) => m.total > 0);

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard
          label="Earnings"
          value={money(s.earnings)}
          note={`from ${plural(s.confirmed.length, 'confirmed booking')}`}
        />
        <StatCard
          label="Nights booked"
          value={s.nights}
          note={s.confirmed.length ? `about ${(s.nights / s.confirmed.length).toFixed(1)} per stay` : 'No stays yet'}
        />
        <StatCard
          label="Awaiting your reply"
          value={s.pending.length}
          note={s.pending.length ? 'Reply in Incoming guests' : 'You are all caught up'}
          highlight={s.pending.length > 0}
        />
        <StatCard
          label="Acceptance rate"
          value={s.acceptance === null ? 'None yet' : `${s.acceptance}%`}
          note="of the requests you replied to"
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, gap: 2, mb: 3 }}>
        {/* Earnings by month */}
        <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700 }}>Earnings by month</Typography>
          <Typography variant="body2" sx={{ color: '#7A7070' }}>
            Confirmed bookings, by check-in month, for the last 6 months.
          </Typography>
          <Box
            role="img"
            aria-label={`Earnings by month: ${s.months.map((m) => `${m.label} ${money(m.total)}`).join(', ')}`}
            sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 170, mt: 2 }}
          >
            {s.months.map((m) => (
              <Box key={m.key} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, minHeight: 18 }}>
                  {m.total ? money(m.total) : ''}
                </Typography>
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 52,
                    height: m.total ? Math.max(6, Math.round((m.total / maxMonth) * 120)) : 4,
                    bgcolor: m.total ? '#457B91' : '#E6E3E3',
                    borderRadius: '6px 6px 0 0',
                  }}
                />
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, borderTop: '1px solid #E6E3E3', pt: 0.75 }}>
            {s.months.map((m) => (
              <Typography key={m.key} variant="caption" sx={{ flex: 1, textAlign: 'center', color: '#7A7070' }}>
                {m.label}
              </Typography>
            ))}
          </Box>
          {!hasEarnings && (
            <Typography variant="body2" sx={{ color: '#7A7070', mt: 1.5 }}>
              Earnings will show up here once you confirm bookings.
            </Typography>
          )}
        </Paper>

        {/* Upcoming stays */}
        <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700 }}>Upcoming stays</Typography>
          <Typography variant="body2" sx={{ color: '#7A7070', mb: 1 }}>
            Confirmed guests, soonest first.
          </Typography>
          {s.upcoming.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#7A7070', mt: 2 }}>No upcoming stays yet.</Typography>
          ) : (
            s.upcoming.slice(0, 4).map((r) => (
              <Box key={r.id} sx={{ py: 1.25, borderTop: '1px solid #E6E3E3' }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>{r.guestName}</Typography>
                <Typography variant="body2" sx={{ color: '#7A7070' }} noWrap>
                  {r.propertyTitle}
                </Typography>
                <Typography variant="body2" sx={{ color: '#7A7070' }}>
                  {fmt(r.checkIn)} to {fmt(r.checkOut)}, {guestSummary(r)}
                </Typography>
              </Box>
            ))
          )}
        </Paper>
      </Box>

      {/* Per property */}
      <Typography sx={{ fontWeight: 700, mb: 1 }}>Your properties at a glance</Typography>
      <TableContainer component={Paper} elevation={0} sx={surfaceSx}>
        <Table size="small" aria-label="Performance by property">
          <TableHead>
            <TableRow>
              <TableCell>Property</TableCell>
              <TableCell align="right">Requests</TableCell>
              <TableCell align="right">Confirmed</TableCell>
              <TableCell align="right">Earnings</TableCell>
              <TableCell align="right">Rating</TableCell>
              <TableCell sx={{ minWidth: 150 }}>Booked, next 30 days</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {s.perProperty.map(({ p, requests, confirmed, earnings, occupancy, rating, ratingCount }) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{p.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#7A7070' }}>{p.city}</Typography>
                </TableCell>
                <TableCell align="right">{requests}</TableCell>
                <TableCell align="right">{confirmed}</TableCell>
                <TableCell align="right">{money(earnings)}</TableCell>
                <TableCell align="right">{rating === null ? 'No reviews' : `${rating.toFixed(1)} (${ratingCount})`}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={occupancy}
                      aria-label={`${p.title} is booked ${occupancy} percent of the next 30 days`}
                      sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E8F1F4' }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 36, textAlign: 'right' }}>{occupancy}%</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{title}</Typography>
      <Typography sx={{ color: '#7A7070', maxWidth: 420, mx: 'auto', mb: action ? 3 : 0 }}>{text}</Typography>
      {action}
    </Box>
  );
}

function PropertyRow({ p, newRequests, onEdit, onDelete }) {
  // Listings created before verification existed have no verificationStatus and count as verified
  const underReview = p.verificationStatus === 'pending';
  const rejected = p.verificationStatus === 'rejected';
  const hiddenByAdmin = !underReview && !rejected && p.published === false;

  return (
    <Box
      sx={{
        ...rowSx,
        display: 'grid',
        gridTemplateColumns: { xs: '92px 1fr', md: '236px 1fr auto' },
        gap: { xs: 1.5, md: 3 },
        alignItems: 'center',
      }}
    >
      {p.images?.[0] ? (
        <Box
          component="img"
          src={p.images[0]}
          alt={p.title}
          sx={{ display: 'block', width: '100%', aspectRatio: '1.45', objectFit: 'cover', borderRadius: '10px' }}
        />
      ) : (
        <Box
          sx={{
            aspectRatio: '1.45',
            borderRadius: '10px',
            bgcolor: '#E8F1F4',
            color: '#2F5E70',
            display: 'grid',
            placeItems: 'center',
            fontSize: '0.75rem',
          }}
        >
          No photo yet
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }} noWrap>{p.title}</Typography>
          {newRequests > 0 && (
            <Chip size="small" label={plural(newRequests, 'new request')} sx={{ bgcolor: '#FBF1C0', color: '#6B5200', fontWeight: 600 }} />
          )}
          {underReview && (
            <Chip size="small" label="Under review" sx={{ bgcolor: '#FBF1C0', color: '#6B5200', fontWeight: 600 }} />
          )}
          {rejected && (
            <Chip size="small" label="Not approved" sx={{ bgcolor: '#F8E1DF', color: '#8A2E26', fontWeight: 600 }} />
          )}
          {hiddenByAdmin && (
            <Chip size="small" label="Hidden by admin" sx={{ bgcolor: '#EFECEC', color: '#7A7070', fontWeight: 600 }} />
          )}
        </Box>
        <Typography variant="body2" sx={{ color: '#7A7070', mt: 0.25, textAlign: 'left' }} noWrap>
          {[p.city, p.type].filter(Boolean).join(', ')}
        </Typography>
        <Typography variant="body2" sx={{ color: '#7A7070', mt: 0.25, textAlign: 'left' }} noWrap>
          {plural(p.bedrooms ?? 0, 'bedroom')}, {plural(p.beds ?? 0, 'bed')}, {plural(p.baths ?? 0, 'bath')}, sleeps {p.capacity ?? 1}
        </Typography>
        {underReview && (
          <Typography variant="body2" sx={{ color: '#6B5200', mt: 0.25, textAlign: 'left' }}>
            Our team is verifying this listing. It will go live once approved.
          </Typography>
        )}
        {rejected && (
          <Typography variant="body2" sx={{ color: '#8A2E26', mt: 0.25, textAlign: 'left' }}>
            {p.rejectionReason ? `Reason: ${p.rejectionReason}. ` : ''}Edit the listing and save to resubmit.
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          gridColumn: { xs: '1 / -1', md: 'auto' },
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          alignItems: { xs: 'center', md: 'flex-end' },
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography sx={{ fontWeight: 700 }}>
          {money(p.pricePerNight)}
          <Box component="span" sx={{ fontWeight: 400, color: '#7A7070' }}> per night</Box>
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit(p)}>
            {rejected ? 'Fix & resubmit' : 'Edit'}
          </Button>
          <IconButton size="small" aria-label={`Delete ${p.title}`} onClick={() => onDelete(p)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}


// ---------- ratings and reviews from your guests ----------
function ReviewsPanel({ properties, reviews, onReply }) {
  const [propertyId, setPropertyId] = useState('all');
  const shown = propertyId === 'all' ? reviews : reviews.filter((r) => r.propertyId === propertyId);
  const count = shown.length;
  const average = count ? shown.reduce((sum, r) => sum + r.rating, 0) / count : null;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    n: shown.filter((r) => r.rating === stars).length,
  }));

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 2, mb: 3 }}>
        <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#7A7070', fontWeight: 600 }}>Average rating</Typography>
          <Typography sx={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}>
            {average === null ? 'None yet' : average.toFixed(1)}
          </Typography>
          <Rating value={average ?? 0} precision={0.1} readOnly />
          <Typography variant="body2" sx={{ color: '#7A7070' }}>{plural(count, 'review')}</Typography>
        </Paper>

        <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Ratings breakdown</Typography>
          {distribution.map(({ stars, n }) => (
            <Box key={stars} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
              <Typography variant="body2" sx={{ width: 52 }}>{plural(stars, 'star')}</Typography>
              <LinearProgress
                variant="determinate"
                value={count ? (n / count) * 100 : 0}
                aria-label={`${n} of ${count} reviews are ${stars} stars`}
                sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: '#E8F1F4' }}
              />
              <Typography variant="body2" sx={{ width: 24, textAlign: 'right' }}>{n}</Typography>
            </Box>
          ))}
        </Paper>
      </Box>

      <TextField
        select
        size="small"
        label="Property"
        value={propertyId}
        onChange={(e) => setPropertyId(e.target.value)}
        sx={{ minWidth: 260, mb: 2 }}
      >
        <MenuItem value="all">All properties</MenuItem>
        {properties.map((p) => (
          <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
        ))}
      </TextField>

      <Paper elevation={0} sx={surfaceSx}>
        {shown.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            text="Guests can review a place after you confirm their booking. Their reviews and ratings will show up here, and you can reply to each one."
          />
        ) : (
          shown.map((r) => {
            const date = r.createdAt?.toDate
              ? r.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : '';
            return (
              <Box key={r.id} sx={rowSx}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{r.guestName}</Typography>
                    <Typography variant="body2" sx={{ color: '#7A7070' }}>
                      {r.propertyTitle}{date ? `, ${date}` : ''}
                    </Typography>
                  </Box>
                  <Rating value={r.rating} readOnly size="small" />
                </Box>
                {r.text && <Typography sx={{ mt: 1 }}>{r.text}</Typography>}
                {r.hostReply && (
                  <Box sx={{ mt: 1, pl: 1.5, borderLeft: '3px solid #E8F1F4' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#7A7070' }}>Your reply</Typography>
                    <Typography variant="body2">{r.hostReply}</Typography>
                  </Box>
                )}
                <Button size="small" sx={{ mt: 1 }} onClick={() => onReply(r)}>
                  {r.hostReply ? 'Edit reply' : 'Reply'}
                </Button>
              </Box>
            );
          })
        )}
      </Paper>
    </Box>
  );
}

export default function MyProperty() {
  const { user, profile, loading } = useAuth();
  const uid = user?.uid;
  const { application, status: hostStatus, loading: hostLoading } = useHostApplication(uid);

  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editing, setEditing] = useState(null);
  const [autoCreate, setAutoCreate] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [replying, setReplying] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [tab, setTab] = useState(0); // 0 dashboard, 1 properties, 2 incoming guests, 3 reviews, 4 availability

  useEffect(() => {
    if (!uid) return undefined;
    const onError = () => setError('Could not load your data. Check your connection and the Firestore rules.');
    const unsubProps = onSnapshot(
      query(collection(db, 'properties'), where('ownerId', '==', uid)),
      (snap) => {
        setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReady(true);
      },
      onError
    );
    const unsubRes = onSnapshot(
      query(collection(db, 'reservations'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setReservations(list);
      },
      onError
    );
    const unsubReviews = onSnapshot(
      query(collection(db, 'reviews'), where('ownerId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setReviews(list);
      },
      () => {}
    );
    return () => {
      unsubProps();
      unsubRes();
      unsubReviews();
    };
  }, [uid]);

  if (loading || hostLoading) {
    return <Box sx={{ py: 12, textAlign: 'center', bgcolor: '#fff', minHeight: '100vh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;

  // Not approved yet: show the application (or the "under review" screen) instead of the listing tools.
  if (hostStatus !== 'approved') {
    return (
      <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
        <NavigationBar />
        <Box sx={{ maxWidth: '100%', mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12 }}>
          <HostApplication application={application} />
        </Box>
      </Box>
    );
  }
  const formOpen = mode !== 'list' || (autoCreate && ready && properties.length === 0);
  const pending = reservations.filter((r) => r.status === 'pending').length;
  const firstName = profile?.firstName || user.displayName || '';

  const startCreate = () => {
    setEditing(null);
    setMode('create');
  };
  const startEdit = (p) => {
    setEditing(p);
    setMode('edit');
  };
  const closeForm = () => {
    setMode('list');
    setAutoCreate(false);
    // `editing` is cleared after the close animation (see the Dialog), so the form
    // doesn't flash back to an empty "create" form while it fades out.
  };
  // Called after the form saved successfully
  const finishForm = () => {
    if (!editing) {
      setNotice('Your listing was submitted. Our team will verify it before it goes live. You can track its status under Properties.');
      setTab(1);
    } else if (editing.verificationStatus === 'rejected') {
      setNotice('Your listing was sent back for review.');
    }
    closeForm();
  };

  // A listing with upcoming bookings (pending requests or confirmed stays that have
  // not ended) cannot be deleted. The host has to decline or cancel those first.
  const remove = async (p) => {
    const upcoming = reservations.filter(
      (r) =>
        r.propertyId === p.id &&
        (r.status === 'pending' || r.status === 'confirmed') &&
        r.checkOut >= todayISO()
    );
    if (upcoming.length > 0) {
      setError(
        `"${p.title}" has ${plural(upcoming.length, 'upcoming booking')}. Decline or cancel ${
          upcoming.length === 1 ? 'it' : 'them'
        } in Incoming guests before deleting this listing.`
      );
      return;
    }
    if (!window.confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    await deleteDoc(doc(db, 'properties', p.id)).catch(() => setError('Could not delete that listing.'));
  };




  const requestsFor = (id) => reservations.filter((r) => r.propertyId === id && r.status === 'pending').length;
  const reviewsByReservation = Object.fromEntries(reviews.map((rv) => [rv.id, rv]));

  // Public reply to a guest's review.
  const openReply = (review) => {
    setReplying(review);
    setReplyText(review.hostReply ?? '');
  };
  const closeReply = () => {
    if (!replySaving) setReplying(null);
  };
  const saveReply = async (text) => {
    setReplySaving(true);
    try {
      await updateDoc(doc(db, 'reviews', replying.id), {
        hostReply: text.trim(),
        hostReplyAt: serverTimestamp(),
      });
      setReplying(null);
    } catch {
      setError('Could not save your reply. Make sure the latest Firestore rules are published.');
    } finally {
      setReplySaving(false);
    }
  };

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', }}>
      <NavigationBar />
      <Box sx={{ maxWidth: '100%', mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        {!ready &&(
          <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
        )}

        {ready && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box>
                <Typography sx={{ color: '#7A7070', fontWeight: 600, textAlign: 'left' }}>Pahinga Host</Typography>
                <Typography
                  component="h1"
                  sx={{ color: 'black', fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.1, mt: 0.5, textAlign: 'left' }}
                >
                  {firstName ? `Manage your properties` : 'Your properties'}
                </Typography>
                <Typography sx={{ color: '#7A7070', mt: 1, textAlign: 'left' }}>
                  Manage your places and see who is coming to stay.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={startCreate}
                sx={{ borderRadius: '10px', px: 2.5, boxShadow: '0 4px 12px rgba(69,123,145,.3)' }}
              >
                Add property
              </Button>
            </Box>

            {pending > 0 && (
              <Box
                role="status"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  bgcolor: '#FBF1C0',
                  borderRadius: '14px',
                  px: 2.5,
                  py: 1.5,
                  mb: 3,
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {pending === 1
                    ? '1 booking request is waiting for your reply.'
                    : `${pending} booking requests are waiting for your reply.`}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  onClick={() => setTab(2)}
                  sx={{ bgcolor: '#fff', color: '#3F3636', '&:hover': { bgcolor: '#fff' } }}
                >
                  Review requests
                </Button>
              </Box>
            )}

            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                mb: 2,
                borderBottom: '1px solid #E6E3E3',
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '1rem' },
              }}
            >
              <Tab label="Dashboard" />
              <Tab label={`Properties (${properties.length})`} />
              <Tab label={`Incoming guests (${reservations.length})`} />
              <Tab label={`Reviews (${reviews.length})`} />
              <Tab label="Availability" />
            </Tabs>

            <Fade in key={tab} timeout={250}>
              <Box>
                {tab === 0 && <Dashboard properties={properties} reservations={reservations} reviews={reviews} />}

                {tab === 1 && (
                  <Paper elevation={0} sx={surfaceSx}>
                    {properties.length === 0 ? (
                      <EmptyState
                        title="No properties yet"
                        text="Add your first place. Our team verifies every new listing, and it goes live for guests once it is approved."
                        action={
                          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
                            Add property
                          </Button>
                        }
                      />
                    ) : (
                      properties.map((p) => (
                        <PropertyRow
                          key={p.id}
                          p={p}
                          newRequests={requestsFor(p.id)}
                          onEdit={startEdit}
                          onDelete={remove}
                        />
                      ))
                    )}
                  </Paper>
                )}

                {tab === 2 && (
                  <IncomingGuests
                    properties={properties}
                    reservations={reservations}
                    reviewsByReservation={reviewsByReservation}
                    onReply={openReply}
                    onError={setError}
                    onNotice={setNotice}
                  />
                )}

                {tab === 3 && <ReviewsPanel properties={properties} reviews={reviews} onReply={openReply} />}

                {tab === 4 && <AvailabilityCalendar properties={properties} reservations={reservations} />}
              </Box>
            </Fade>
          </>
        )}
      </Box>

        <Dialog
          open={formOpen}
          onClose={(_, reason) => {
            // Clicking the backdrop would throw away a half-filled form, so only Esc and Cancel close it.
            if (reason !== 'backdropClick') closeForm();
          }}
          scroll="body"
          maxWidth={false}
          aria-label={editing ? 'Edit listing' : 'Create listing'}
          slotProps={{
            paper: {
              sx: {
                width: '100%',
                maxWidth: 960,
                m: { xs: 1, md: 4 },
                bgcolor: 'transparent',
                boxShadow: 'none',
                backgroundImage: 'none',
                overflow: 'visible',
              },
            },
            transition: { onExited: () => setEditing(null) },
          }}
        >
          <ListingForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onDone={finishForm}
            onCancel={closeForm}
          />
        </Dialog>

      <Dialog open={Boolean(replying)} onClose={closeReply} fullWidth maxWidth="sm" aria-labelledby="reply-title">
        <DialogTitle id="reply-title" sx={{ textAlign: 'left', color: '#3F3636', fontWeight: 700, fontSize: '1.25rem' }}>
          Reply to {replying?.guestName}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'left' }}>
          {replying && (
            <Box sx={{ mb: 2 }}>
              <Rating value={replying.rating} readOnly size="small" />
              {replying.text && <Typography variant="body2" sx={{ mt: 0.25 }}>{replying.text}</Typography>}
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Your reply"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Typography variant="caption" sx={{ color: '#7A7070', display: 'block', mt: 0.5 }}>
            Your reply is shown publicly under the review.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {replying?.hostReply && (
            <Button color="inherit" onClick={() => saveReply('')} disabled={replySaving} sx={{ mr: 'auto' }}>
              Remove reply
            </Button>
          )}
          <Button color="inherit" onClick={closeReply} disabled={replySaving}>Cancel</Button>
          <Button variant="contained" onClick={() => saveReply(replyText)} disabled={replySaving || !replyText.trim()}>
            {replySaving ? 'Saving…' : 'Save reply'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}