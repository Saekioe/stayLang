import { useEffect, useState } from 'react';
import { Alert, Box, Paper, Typography } from '@mui/material';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

export default function Report() {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reservations'), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream reservations.'));
    return unsub;
  }, []);

  const confirmed = reservations.filter((r) => r.status === 'confirmed');
  const totalEarnings = confirmed.reduce((sum, r) => sum + (r.total || 0), 0);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Reports & Analytics</Typography>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Booking Volume Summary</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Total confirmed platform revenue stands at ${totalEarnings.toLocaleString()}.
        </Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Confirmed Stays</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{confirmed.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Cancelled/Declined</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {reservations.filter((r) => r.status === 'declined').length}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </>
  );
}