import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Rating, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { PageHeader, Panel, colors, tableSx } from './adminUi';
 
export default function ReviewModeration() {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
 
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reviews'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setReviews(list);
    }, () => setError('Failed to stream reviews.'));
    return unsub;
  }, []);
 
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setSuccess('Review removed successfully.');
    } catch {
      setError('Could not delete review.');
    }
  };
 
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
 
      <PageHeader
        title="Review Moderation"
        subtitle="Review guest feedback and host responses to keep your platform trustworthy."
      />
 
      <Panel
        title="Guest reviews"
        subtitle="Complete comments and host replies"
        footer={`Showing all ${reviews.length} reviews`}
      >
        <TableContainer>
          <Table sx={{ ...tableSx, '& .MuiTableBody-root .MuiTableRow-root': { height: 112 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Author</TableCell>
                <TableCell>Property</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell>Host reply</TableCell>
                <TableCell align="right">Moderate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No reviews submitted yet.</TableCell></TableRow>
              ) : (
                reviews.map((rev) => (
                  <TableRow key={rev.id}>
                    <TableCell>{rev.guestName || 'Anonymous'}</TableCell>
                    <TableCell>{rev.propertyTitle || '-'}</TableCell>
                    <TableCell>
                      <Box>
                        <Rating value={rev.rating ?? 0} readOnly size="small" sx={{ color: '#F5A800' }} />
                        <Typography sx={{ fontSize: 12, color: colors.muted }}>{rev.rating ?? 0} out of 5</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>{rev.text || <em>No comment</em>}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>{rev.hostReply || '-'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => handleDelete(rev.id)}
                        startIcon={<DeleteOutlineIcon sx={{ fontSize: '18px !important' }} />}
                        sx={{ color: colors.danger, fontSize: 14, fontWeight: 500 }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </>
  );
}