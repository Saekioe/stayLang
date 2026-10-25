import { useEffect, useState } from 'react';
import {
  Alert, IconButton, Paper, Rating, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

export default function ReviewModeration() {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reviews'), (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record permanently?')) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setSuccess('Record removed successfully.');
    } catch {
      setError('Could not delete record.');
    }
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Review Moderation</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#edf2f7' }}>
            <TableRow>
              <TableCell>Author</TableCell>
              <TableCell>Rating</TableCell>
              <TableCell>Comment</TableCell>
              <TableCell align="right">Moderate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reviews.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>No reviews flagged or submitted.</TableCell></TableRow>
            ) : (
              reviews.map((rev) => (
                <TableRow key={rev.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{rev.userName || 'Anonymous'}</TableCell>
                  <TableCell><Rating value={rev.rating || 5} readOnly size="small" /></TableCell>
                  <TableCell>{rev.comment}</TableCell>
                  <TableCell align="right">
                    <IconButton color="error" size="small" onClick={() => handleDelete(rev.id)}>
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