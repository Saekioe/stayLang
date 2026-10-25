import { useEffect, useState } from 'react';
import {
  Alert, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

export default function ReservationMonitoring() {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reservations'), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream reservations.'));
    return unsub;
  }, []);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Platform Reservations</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#edf2f7' }}>
            <TableRow>
              <TableCell>Guest</TableCell>
              <TableCell>Property</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservations.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No reservations found.</TableCell></TableRow>
            ) : (
              reservations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.guestName}</TableCell>
                  <TableCell>{r.propertyTitle}</TableCell>
                  <TableCell>{r.checkIn} to {r.checkOut}</TableCell>
                  <TableCell>${r.total}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} color={r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : 'default'} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}