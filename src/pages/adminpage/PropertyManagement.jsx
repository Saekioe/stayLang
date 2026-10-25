import { useEffect, useState } from 'react';
import {
  Alert, Button, Chip, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

export default function PropertyManagement() {
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream properties.'));
    return unsub;
  }, []);

  const handleUpdateStatus = async (id, updates) => {
    try {
      await updateDoc(doc(db, 'properties', id), updates);
      setSuccess('Record updated successfully.');
    } catch {
      setError('Could not complete administrative action.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record permanently?')) return;
    try {
      await deleteDoc(doc(db, 'properties', id));
      setSuccess('Record removed successfully.');
    } catch {
      setError('Could not delete record.');
    }
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Property Management</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#edf2f7' }}>
            <TableRow>
              <TableCell>Property</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Nightly Rate</TableCell>
              <TableCell>Visibility</TableCell>
              <TableCell align="right">Controls</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {properties.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No properties found.</TableCell></TableRow>
            ) : (
              properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{p.title}</TableCell>
                  <TableCell>{p.city}</TableCell>
                  <TableCell>${p.pricePerNight}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.hidden ? 'Hidden' : 'Visible'} color={p.hidden ? 'default' : 'primary'} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => handleUpdateStatus(p.id, { hidden: !p.hidden })}>
                      {p.hidden ? 'Publish' : 'Hide'}
                    </Button>
                    <IconButton color="error" size="small" onClick={() => handleDelete(p.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
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