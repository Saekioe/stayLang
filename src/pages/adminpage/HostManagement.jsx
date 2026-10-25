import { useEffect, useState } from 'react';
import {
  Alert, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

export default function HostManagement() {
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream users.'));

    const unsubProps = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream properties.'));

    return () => {
      unsubUsers();
      unsubProps();
    };
  }, []);

  const handleUpdateStatus = async (id, updates) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
      setSuccess('Record updated successfully.');
    } catch {
      setError('Could not complete administrative action.');
    }
  };

  const hosts = users.filter((u) => u.isHost || properties.some((p) => p.ownerId === u.id));

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Host Approvals & Status</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#edf2f7' }}>
            <TableRow>
              <TableCell>Host</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Properties Count</TableCell>
              <TableCell>Approval Status</TableCell>
              <TableCell align="right">Moderation</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hosts.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No hosts found.</TableCell></TableRow>
            ) : (
              hosts.map((h) => {
                const count = properties.filter((p) => p.ownerId === h.id).length;
                return (
                  <TableRow key={h.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{h.firstName} {h.lastName}</TableCell>
                    <TableCell>{h.email}</TableCell>
                    <TableCell>{count} listings</TableCell>
                    <TableCell>
                      <Chip size="small" label={h.hostApproved ? 'Approved' : 'Pending Review'} color={h.hostApproved ? 'success' : 'warning'} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" color="success" onClick={() => handleUpdateStatus(h.id, { hostApproved: true })}>Approve</Button>
                      <Button size="small" color="error" onClick={() => handleUpdateStatus(h.id, { hostApproved: false })}>Reject</Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}