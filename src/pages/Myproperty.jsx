import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Fade, IconButton, LinearProgress, Paper,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Auth';
import NavigationBar from '../components/NavigationBar';
import ListingForm from '../components/Listingform';

const ui = {
  ink: '#3F3636',
  muted: '#7A7070',
  line: '#E6E3E3',
  teal: '#457B91',
  tealSoft: '#E8F1F4',
  tealText: '#2F5E70',
  butter: '#FBF1C0',
  butterTint: '#FFFBE8',
  sage: '#DFEEDF',
  sageText: '#2E6B3F',
};

const statusStyle = {
  pending: { bgcolor: ui.butter, color: '#6B5200' },
  confirmed: { bgcolor: ui.sage, color: ui.sageText },
  declined: { bgcolor: '#EFECEC', color: ui.muted },
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
const money = (n) => `$${Math.round(n).toLocaleString()}`;

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
  border: `1px solid ${ui.line}`,
  borderRadius: '16px',
  overflow: 'hidden',
};

const rowSx = {
  p: 2,
  borderTop: `1px solid ${ui.line}`,
  '&:first-of-type': { borderTop: 0 },
};

// ---------- dashboard numbers ----------
function computeStats(properties, reservations) {
  const today = dayNum(toISODate(new Date()));
  const confirmed = reservations.filter((r) => r.status === 'confirmed');
  const pending = reservations.filter((r) => r.status === 'pending');
  const declined = reservations.filter((r) => r.status === 'declined');

  const earnings = confirmed.reduce((sum, r) => sum + (r.total ?? 0), 0);
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
    if (month) month.total += r.total ?? 0;
  });

  const upcoming = confirmed
    .filter((r) => r.checkOut && dayNum(r.checkOut) >= today)
    .sort((a, b) => dayNum(a.checkIn) - dayNum(b.checkIn));

  // Per property: requests, confirmed bookings, earnings, and how full the next 30 days are.
  const windowEnd = today + 30;
  const perProperty = properties.map((p) => {
    const mine = reservations.filter((r) => r.propertyId === p.id);
    const conf = mine.filter((r) => r.status === 'confirmed');
    const bookedNights = conf.reduce(
      (sum, r) => sum + Math.max(0, Math.min(dayNum(r.checkOut), windowEnd) - Math.max(dayNum(r.checkIn), today)),
      0
    );
    return {
      p,
      requests: mine.length,
      confirmed: conf.length,
      earnings: conf.reduce((sum, r) => sum + (r.total ?? 0), 0),
      occupancy: Math.min(100, Math.round((bookedNights / 30) * 100)),
    };
  });

  return { confirmed, pending, earnings, nights, acceptance, months, upcoming, perProperty };
}

function StatCard({ label, value, note, highlight }) {
  return (
    <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5, bgcolor: highlight ? ui.butterTint : '#fff' }}>
      <Typography variant="body2" sx={{ color: ui.muted, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
      <Typography variant="body2" sx={{ color: ui.muted, mt: 0.25 }}>{note}</Typography>
    </Paper>
  );
}

function Dashboard({ properties, reservations }) {
  const s = useMemo(() => computeStats(properties, reservations), [properties, reservations]);
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
          <Typography variant="body2" sx={{ color: ui.muted }}>
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
                    bgcolor: m.total ? ui.teal : ui.line,
                    borderRadius: '6px 6px 0 0',
                  }}
                />
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, borderTop: `1px solid ${ui.line}`, pt: 0.75 }}>
            {s.months.map((m) => (
              <Typography key={m.key} variant="caption" sx={{ flex: 1, textAlign: 'center', color: ui.muted }}>
                {m.label}
              </Typography>
            ))}
          </Box>
          {!hasEarnings && (
            <Typography variant="body2" sx={{ color: ui.muted, mt: 1.5 }}>
              Earnings will show up here once you confirm bookings.
            </Typography>
          )}
        </Paper>

        {/* Upcoming stays */}
        <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5 }}>
          <Typography sx={{ fontWeight: 700 }}>Upcoming stays</Typography>
          <Typography variant="body2" sx={{ color: ui.muted, mb: 1 }}>
            Confirmed guests, soonest first.
          </Typography>
          {s.upcoming.length === 0 ? (
            <Typography variant="body2" sx={{ color: ui.muted, mt: 2 }}>No upcoming stays yet.</Typography>
          ) : (
            s.upcoming.slice(0, 4).map((r) => (
              <Box key={r.id} sx={{ py: 1.25, borderTop: `1px solid ${ui.line}` }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>{r.guestName}</Typography>
                <Typography variant="body2" sx={{ color: ui.muted }} noWrap>
                  {r.propertyTitle}
                </Typography>
                <Typography variant="body2" sx={{ color: ui.muted }}>
                  {fmt(r.checkIn)} to {fmt(r.checkOut)}, {plural(r.guests ?? 1, 'guest')}
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
              <TableCell sx={{ minWidth: 150 }}>Booked, next 30 days</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {s.perProperty.map(({ p, requests, confirmed, earnings, occupancy }) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{p.title}</Typography>
                  <Typography variant="body2" sx={{ color: ui.muted }}>{p.city}</Typography>
                </TableCell>
                <TableCell align="right">{requests}</TableCell>
                <TableCell align="right">{confirmed}</TableCell>
                <TableCell align="right">{money(earnings)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={occupancy}
                      aria-label={`${p.title} is booked ${occupancy} percent of the next 30 days`}
                      sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: ui.tealSoft }}
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
      <Typography sx={{ color: ui.muted, maxWidth: 420, mx: 'auto', mb: action ? 3 : 0 }}>{text}</Typography>
      {action}
    </Box>
  );
}

function PropertyRow({ p, newRequests, onEdit, onDelete }) {
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
            bgcolor: ui.tealSoft,
            color: ui.tealText,
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
            <Chip size="small" label={plural(newRequests, 'new request')} sx={{ bgcolor: ui.butter, color: '#6B5200', fontWeight: 600 }} />
          )}
        </Box>
        <Typography variant="body2" sx={{ color: ui.muted, mt: 0.25, textAlign: 'left' }} noWrap>
          {[p.city, p.type].filter(Boolean).join(', ')}
        </Typography>
        <Typography variant="body2" sx={{ color: ui.muted, mt: 0.25, textAlign: 'left' }} noWrap>
          {plural(p.bedrooms ?? 0, 'bedroom')}, {plural(p.beds ?? 0, 'bed')}, {plural(p.baths ?? 0, 'bath')}, sleeps {p.capacity ?? 1}
        </Typography>
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
          ${p.pricePerNight}
          <Box component="span" sx={{ fontWeight: 400, color: ui.muted }}> per night</Box>
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit(p)}>
            Edit
          </Button>
          <IconButton size="small" aria-label={`Delete ${p.title}`} onClick={() => onDelete(p)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

function RequestRow({ r, onStatus }) {
  const initials = (r.guestName || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const pending = r.status === 'pending';
  return (
    <Box
      sx={{
        ...rowSx,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.2fr 1.5fr auto' },
        gap: { xs: 1.5, md: 3 },
        alignItems: 'center',
        bgcolor: pending ? ui.butterTint : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Avatar sx={{ bgcolor: ui.tealSoft, color: ui.tealText, fontWeight: 700 }}>{initials}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{r.guestName}</Typography>
          <Typography variant="body2" sx={{ color: ui.muted }} noWrap>{r.guestEmail}</Typography>
        </Box>
      </Box>

      <Box>
        <Typography sx={{ fontWeight: 600 }}>{r.propertyTitle}</Typography>
        <Typography variant="body2" sx={{ color: ui.muted }}>
          {fmt(r.checkIn)} to {fmt(r.checkOut)}, {plural(r.nights ?? 0, 'night')}
        </Typography>
        <Typography variant="body2" sx={{ color: ui.muted }}>
          {plural(r.guests ?? 1, 'guest')}, ${r.total} total
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={capitalize(r.status)} sx={{ fontWeight: 600, ...statusStyle[r.status] }} />
        {pending && (
          <>
            <Button size="small" variant="contained" disableElevation startIcon={<CheckIcon />} onClick={() => onStatus(r, 'confirmed')}>
              Confirm
            </Button>
            <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={() => onStatus(r, 'declined')}>
              Decline
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

export default function MyProperty() {
  const { user, profile, loading } = useAuth();
  const uid = user?.uid;

  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editing, setEditing] = useState(null);
  const [autoCreate, setAutoCreate] = useState(true);
  const [tab, setTab] = useState(0); // 0 dashboard, 1 properties, 2 incoming guests

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
    return () => {
      unsubProps();
      unsubRes();
    };
  }, [uid]);

  if (loading) {
    return <Box sx={{ py: 12, textAlign: 'center', bgcolor: '#fff', minHeight: '100vh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const view = mode === 'list' && autoCreate && ready && properties.length === 0 ? 'create' : mode;
  const pending = reservations.filter((r) => r.status === 'pending').length;
  const firstName = profile?.firstName || user.displayName || '';

  const startEdit = (p) => {
    setEditing(p);
    setMode('edit');
  };
  const backToList = () => {
    setEditing(null);
    setMode('list');
    setAutoCreate(false);
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    await deleteDoc(doc(db, 'properties', p.id)).catch(() => setError('Could not delete that listing.'));
  };

  // Confirm or decline a request, and leave a message in the guest's inbox.
  const setStatus = async (r, status) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'reservations', r.id), { status });
      batch.set(doc(collection(db, 'notifications')), {
        userId: r.guestId,
        reservationId: r.id,
        type: status === 'confirmed' ? 'reservation_confirmed' : 'reservation_declined',
        propertyTitle: r.propertyTitle,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: r.nights ?? 0,
        total: r.total ?? 0,
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch {
      setError('Could not update that reservation.');
    }
  };

  const requestsFor = (id) => reservations.filter((r) => r.propertyId === id && r.status === 'pending').length;

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
      <NavigationBar />
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {!ready && view === 'list' && (
          <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
        )}

        {(view === 'create' || view === 'edit') && (
          <ListingForm
            key={editing?.id ?? 'new'}
            initial={view === 'edit' ? editing : null}
            onDone={backToList}
            onCancel={properties.length > 0 ? backToList : undefined}
          />
        )}

        {view === 'list' && ready && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box>
                <Typography sx={{ color: ui.muted, fontWeight: 600, textAlign: 'left' }}>StayLang Host</Typography>
                <Typography
                  component="h1"
                  sx={{ color: 'black', fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.1, mt: 0.5 }}
                >
                  {firstName ? `Welcome back, ${firstName}` : 'Your properties'}
                </Typography>
                <Typography sx={{ color: ui.muted, mt: 1, textAlign: 'left' }}>
                  Manage your places and see who is coming to stay.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setMode('create')}
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
                  bgcolor: ui.butter,
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
                  sx={{ bgcolor: '#fff', color: ui.ink, '&:hover': { bgcolor: '#fff' } }}
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
                borderBottom: `1px solid ${ui.line}`,
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '1rem' },
              }}
            >
              <Tab label="Dashboard" />
              <Tab label={`Properties (${properties.length})`} />
              <Tab label={`Incoming guests (${reservations.length})`} />
            </Tabs>

            <Fade in key={tab} timeout={250}>
              <Box>
                {tab === 0 && <Dashboard properties={properties} reservations={reservations} />}

                {tab === 1 && (
                  <Paper elevation={0} sx={surfaceSx}>
                    {properties.length === 0 ? (
                      <EmptyState
                        title="No properties yet"
                        text="Add your first place. It goes live for guests as soon as you publish it."
                        action={
                          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMode('create')}>
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
                  <Paper elevation={0} sx={surfaceSx}>
                    {reservations.length === 0 ? (
                      <EmptyState
                        title="No booking requests yet"
                        text="When a guest requests one of your places, they will show up here for you to confirm or decline."
                      />
                    ) : (
                      reservations.map((r) => <RequestRow key={r.id} r={r} onStatus={setStatus} />)
                    )}
                  </Paper>
                )}
              </Box>
            </Fade>
          </>
        )}
      </Box>
    </Box>
  );
}