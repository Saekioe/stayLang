import { useMemo, useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, Paper, Tab, Tabs, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import { useNotifications } from '../dataqueries/Data';
import NavigationBar from '../components/NavigationBar';
import { money } from '../dataqueries/Booking';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const fmt = (d) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

const timeAgo = (ts) => {
  if (!ts?.toDate) return '';
  const secs = Math.max(0, Math.round((Date.now() - ts.toDate().getTime()) / 1000));
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)} d ago`;
  return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const surfaceSx = {
  bgcolor: '#ffffff',
  border: '1px solid #E6E3E3',
  borderRadius: '16px',
  overflow: 'hidden',
};

const CHIP = {
  green: { bgcolor: '#DFEEDF', color: '#2E6B3F' },
  yellow: { bgcolor: '#FBF1C0', color: '#6B5200' },
  grey: { bgcolor: '#EFECEC', color: '#7A7070' },
  red: { bgcolor: '#F8E1DF', color: '#8A2E26' },
  blue: { bgcolor: '#E3EAF7', color: '#27437A' },
  teal: { bgcolor: '#E8F1F4', color: '#2F5E70' },
};

// Is this message for the user as a host? Older messages have no `recipient` field.
const isHostNote = (n) =>
  n.recipient
    ? n.recipient === 'host'
    : ['reservation_requested', 'payment_received', 'damage_paid'].includes(n.type) ||
      (n.type === 'reservation_cancelled' && n.cancelledBy === 'guest');

// Turns a notification document into text, a status chip, and a link.
function describe(n) {
  const host = isHostNote(n);
  const link = host ? '/my-property' : '/my-bookings';
  const when = `${fmt(n.checkIn)} to ${fmt(n.checkOut)}, ${plural(n.nights ?? 0, 'night')}`;
  const place = n.propertyTitle || 'your booking';

  switch (n.type) {
    case 'reservation_requested':
      return {
        title: `New booking request for ${place}`,
        body: `${n.guestName ? `${n.guestName}: ` : ''}${when}. Total ${money(n.total)}.`,
        chip: { label: 'New request', sx: CHIP.yellow },
        link,
      };
    case 'reservation_pending':
      return {
        title: `Your request for ${place} was sent`,
        body: `${when}. Waiting for the host to reply.`,
        chip: { label: 'Pending', sx: CHIP.yellow },
        link,
      };
    case 'reservation_confirmed':
      return {
        title: `Your booking at ${place} is confirmed`,
        body: `${when}. Total ${money(n.total)}.`,
        chip: { label: 'Confirmed', sx: CHIP.green },
        link,
      };
    case 'reservation_declined':
      return {
        title: `Your request for ${place} was declined`,
        body: `${when}. You can look for other places or dates.`,
        chip: { label: 'Declined', sx: CHIP.grey },
        link,
      };
    case 'reservation_unavailable':
      return {
        title: `Dates no longer available at ${place}`,
        body: `${when}. The host confirmed another booking for these dates. You can look for other dates.`,
        chip: { label: 'Unavailable', sx: CHIP.grey },
        link,
      };
    case 'reservation_cancelled': {
      const by = n.cancelledBy;
      let title;
      if (host) {
        title = by === 'guest' ? `A guest cancelled their booking at ${place}` : `You cancelled a booking at ${place}`;
      } else {
        title = by === 'host' ? `The host cancelled your booking at ${place}` : `You cancelled your booking at ${place}`;
      }
      return {
        title,
        body: `${when}. The dates are open for booking again.`,
        chip: { label: 'Cancelled', sx: CHIP.red },
        link,
      };
    }
    case 'cancellation_fee_due':
      return {
        title: `Cancellation fee due for ${place}`,
        body: `${when}. Pay ${money(n.amount)} to finish cancelling.`,
        chip: { label: 'Fee due', sx: CHIP.red },
        link,
      };
    case 'cancellation_fee_paid':
      return {
        title: host ? `Cancellation fee received for ${place}` : `Cancellation fee paid for ${place}`,
        body: `${when}. ${money(n.amount)} was paid.`,
        chip: { label: 'Paid', sx: CHIP.green },
        link,
      };
    case 'damage_reported':
      return {
        title: `Damage reported at ${place}`,
        body: `${when}. The host added a charge of ${money(n.amount)}. Open the booking to see the details and pay it.`,
        chip: { label: 'Damage charge', sx: CHIP.red },
        link,
      };
    case 'damage_paid':
      return {
        title: host ? `Damage charge paid for ${place}` : `Damage charge paid for ${place}`,
        body: `${when}. ${money(n.amount)} was paid.`,
        chip: { label: 'Paid', sx: CHIP.green },
        link,
      };
    case 'payment_confirmed':
      return {
        title: `Payment received for ${place}`,
        body: `${when}. You paid ${money(n.total)}.`,
        chip: { label: 'Paid', sx: CHIP.green },
        link,
      };
    case 'payment_received':
      return {
        title: `A guest paid for ${place}`,
        body: `${when}. ${money(n.total)} was paid.`,
        chip: { label: 'Paid', sx: CHIP.green },
        link,
      };
    case 'payment_refunded':
      return {
        title: `Your payment for ${place} was refunded`,
        body: `${when}. ${money(n.total)} was returned to you.`,
        chip: { label: 'Refunded', sx: CHIP.blue },
        link,
      };
    default:
      return {
        title: n.propertyTitle ?? 'Update',
        body: when,
        chip: { label: 'Update', sx: CHIP.teal },
        link,
      };
  }
}

export default function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, error: loadError, unread } = useNotifications(user?.uid);
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => (tab === 'unread' ? items.filter((n) => !n.read) : items), [items, tab]);

  if (authLoading) {
    return <Box sx={{ py: 12, textAlign: 'center', bgcolor: '#fff', minHeight: '100vh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const markRead = async (n) => {
    if (n.read) return;
    try {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    } catch {
      setError('Could not mark that message as read.');
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    setError('');
    try {
      const batch = writeBatch(db);
      items.filter((n) => !n.read).forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch {
      setError('Could not mark all messages as read.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (n) => {
    try {
      await deleteDoc(doc(db, 'notifications', n.id));
    } catch {
      setError('Could not delete that message.');
    }
  };

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
      <NavigationBar />
      <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12, textAlign: 'left' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography component="h1" sx={{ color: 'black', fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.1 }}>
              Notifications
            </Typography>
            <Typography sx={{ color: '#7A7070', mt: 1 }}>
              Booking updates as a guest and as a host
            </Typography>
          </Box>
          <Button variant="outlined" disabled={busy || unread === 0} onClick={markAllRead}>
            Mark all as read
          </Button>
        </Box>

        {(error || loadError) && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error || 'We could not load your notifications. Check your connection and that the latest Firestore rules are published.'}
          </Alert>
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
          <Tab value="all" label={`All (${items.length})`} />
          <Tab value="unread" label={`Unread (${unread})`} />
        </Tabs>

        <Paper elevation={0} sx={surfaceSx}>
          {loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : shown.length === 0 ? (
            <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>
                {items.length === 0 ? 'No notifications yet' : 'You are all caught up'}
              </Typography>
              <Typography sx={{ color: '#7A7070', maxWidth: 420, mx: 'auto' }}>
                {items.length === 0
                  ? 'Booking requests, confirmations, cancellations and payment updates will show up here.'
                  : 'There are no unread messages.'}
              </Typography>
            </Box>
          ) : (
            shown.map((n) => {
              const d = describe(n);
              return (
                <Box
                  key={n.id}
                  onClick={() => markRead(n)}
                  sx={{
                    p: 2,
                    borderTop: '1px solid #E6E3E3',
                    '&:first-of-type': { borderTop: 0 },
                    bgcolor: n.read ? 'transparent' : '#F2F8FA',
                    cursor: n.read ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0 }}>
                    <Box
                      aria-hidden
                      sx={{
                        width: 10,
                        height: 10,
                        mt: 0.8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor: n.read ? 'transparent' : '#457B91',
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: n.read ? 600 : 700 }}>{d.title}</Typography>
                        <Chip size="small" label={d.chip.label} sx={{ fontWeight: 600, ...d.chip.sx }} />
                        <Chip size="small" variant="outlined" label={isHostNote(n) ? 'As host' : 'As guest'} />
                      </Box>
                      <Typography variant="body2" sx={{ color: '#7A7070', mt: 0.25 }}>{d.body}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#7A7070' }}>{timeAgo(n.createdAt)}</Typography>
                        <Button
                          component={RouterLink}
                          to={d.link}
                          size="small"
                          onClick={() => markRead(n)}
                          sx={{ textTransform: 'none', p: 0, minWidth: 0 }}
                        >
                          View booking
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label="Delete notification"
                    onClick={(e) => { e.stopPropagation(); remove(n); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })
          )}
        </Paper>
      </Box>
    </Box>
  );
}