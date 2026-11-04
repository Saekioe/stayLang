import { useEffect, useState } from 'react';
import {
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { STATUS_LABELS, money, statusOf } from '../../dataqueries/Booking';
import { PageHeader, Panel, StatusPill, colors, tableSx } from './adminUi';
 
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
 
      <PageHeader
        title="Reservation Monitoring"
        subtitle="Monitor platform reservations, stay dates, booking amounts and outcomes."
      />
 
      <Panel
        title="Platform Reservations"
        subtitle="All booking statuses in one view"
        footer={`Showing all ${reservations.length} reservations · Amounts in PHP`}
      >
        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Guest</TableCell>
                <TableCell>Property</TableCell>
                <TableCell>Dates · Check-in → Check-out</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No reservations found.</TableCell></TableRow>
              ) : (
                reservations.map((r) => {
                  const status = statusOf(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.guestName}</TableCell>
                      <TableCell>{r.propertyTitle}</TableCell>
                      <TableCell>
                        <Typography component="span" sx={{ fontSize: 14, color: colors.link }}>{r.checkIn}</Typography>
                        <Typography component="span" sx={{ fontSize: 14, mx: 1 }}>to</Typography>
                        <Typography component="span" sx={{ fontSize: 14, color: colors.link }}>{r.checkOut}</Typography>
                      </TableCell>
                      <TableCell>{money(r.total)}</TableCell>
                      <TableCell>
                        <StatusPill label={STATUS_LABELS[status] ?? r.status} variant={status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </>
  );
}