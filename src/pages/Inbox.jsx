import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Paper, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Auth';
import { useNotifications } from '../Data';
import NavigationBar from '../components/NavigationBar';

const ui = {
  muted: '#7A7070',
  line: '#E6E3E3',
  teal: '#457B91',
  tealTint: '#F1F7F9',
  sage: '#DFEEDF',
  sageText: '#2E6B3F',
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmt = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const when = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

function Message({ n, onRead, onDelete }) {
  const confirmed = n.type === 'reservation_confirmed';
  return (
    <Box
      sx={{
        p: 2,
        display: 'grid',
        gridTemplateColumns: '12px 1fr auto',
        gap: 1.5,
        alignItems: 'start',
        borderTop: `1px solid ${ui.line}`,
        '&:first-of-type': { borderTop: 0 },
        bgcolor: n.read ? 'transparent' : ui.tealTint,
      }}
    >
      <Box
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: '50%', mt: 1, bgcolor: n.read ? 'transparent' : ui.teal }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: n.read ? 600 : 700 }}>
            {confirmed
              ? `Your stay at ${n.propertyTitle} is confirmed`
              : `Your request for ${n.propertyTitle} was declined`}
          </Typography>
          <Chip
            size="small"
            label={confirmed ? 'Confirmed' : 'Declined'}
            sx={
              confirmed
                ? { bgcolor: ui.sage, color: ui.sageText, fontWeight: 600 }
                : { bgcolor: '#EFECEC', color: ui.muted, fontWeight: 600 }
            }
          />
        </Box>
        <Typography variant="body2" sx={{ color: ui.muted, mt: 0.25 }}>
          {fmt(n.checkIn)} to {fmt(n.checkOut)}, {plural(n.nights ?? 0, 'night')}, ${n.total} total
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {confirmed
            ? 'The host accepted your request, so your dates are reserved.'
            : 'The host could not accept these dates. You can try different dates or look at other places.'}
        </Typography>
        {when(n.createdAt) && (
          <Typography variant="caption" sx={{ color: ui.muted }}>{when(n.createdAt)}</Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {!n.read && (
          <Button size="small" onClick={() => onRead(n)}>Mark as read</Button>
        )}
        <IconButton size="small" aria-label="Delete message" onClick={() => onDelete(n)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function Inbox() {
  const { user, loading } = useAuth();
  const { items, loading: loadingItems, unread } = useNotifications(user?.uid);
  const [error, setError] = useState('');

  if (loading) {
    return <Box sx={{ py: 12, textAlign: 'center', bgcolor: '#fff', minHeight: '100vh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const markRead = (n) =>
    updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() =>
      setError('Could not update that message.')
    );

  const markAllRead = async () => {
    try {
      const batch = writeBatch(db);
      items.filter((n) => !n.read).forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch {
      setError('Could not update your messages.');
    }
  };

  const remove = (n) =>
    deleteDoc(doc(db, 'notifications', n.id)).catch(() => setError('Could not delete that message.'));

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
      <NavigationBar />
      <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, md: 4 }, pt: 12, pb: 12, textAlign: 'left' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography
              component="h1"
              sx={{ color: 'black', fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.1 }}
            >
              Inbox
            </Typography>
            <Typography sx={{ color: ui.muted, mt: 1 }}>
              Updates about your booking requests.
            </Typography>
          </Box>
          {unread > 0 && (
            <Button variant="outlined" onClick={markAllRead}>Mark all as read</Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Paper elevation={0} sx={{ bgcolor: '#fff', border: `1px solid ${ui.line}`, borderRadius: '16px', overflow: 'hidden' }}>
          {loadingItems ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : items.length === 0 ? (
            <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>Nothing here yet</Typography>
              <Typography sx={{ color: ui.muted, maxWidth: 420, mx: 'auto' }}>
                When a host confirms or declines one of your booking requests, you will see it here.
              </Typography>
            </Box>
          ) : (
            items.map((n) => <Message key={n.id} n={n} onRead={markRead} onDelete={remove} />)
          )}
        </Paper>
      </Box>
    </Box>
  );
}