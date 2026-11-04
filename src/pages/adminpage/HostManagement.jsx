import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

const CHIP = {
  pending: { label: 'Pending Review', color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
};

function Detail({ label, children }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{children || 'Not provided'}</Typography>
    </Box>
  );
}

export default function HostManagement() {
  const [applications, setApplications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'hostApplications'), (snap) => {
      setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream host applications.'));

    const unsubProps = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream properties.'));

    return () => {
      unsubApps();
      unsubProps();
    };
  }, []);

  // Pending first, then newest.
  const rows = useMemo(
    () =>
      [...applications].sort(
        (a, b) =>
          (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) ||
          (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0)
      ),
    [applications]
  );

  const openReview = (app) => {
    setSelected(app);
    setNote(app.reviewNote ?? '');
    setNoteError(false);
  };

  const decide = async (app, status) => {
    const approved = status === 'approved';
    if (!approved && !note.trim()) return setNoteError(true);
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'hostApplications', app.id), {
        status,
        reviewNote: approved ? '' : note.trim(),
        reviewedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', app.id), { isHost: approved, hostApproved: approved });
      // Rejecting or revoking a host also hides their listings from guests.
      if (!approved) {
        properties
          .filter((p) => p.ownerId === app.id)
          .forEach((p) => batch.update(doc(db, 'properties', p.id), { published: false }));
      }
      await batch.commit();
      setSuccess(approved ? 'Host approved. They can now publish listings.' : 'Application rejected.');
      setSelected(null);
    } catch {
      setError('Could not complete administrative action.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Host Approvals & Status</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#edf2f7' }}>
            <TableRow>
              <TableCell>Applicant</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Planned property</TableCell>
              <TableCell>Listings</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Review</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No host applications yet.</TableCell></TableRow>
            ) : (
              rows.map((a) => {
                const count = properties.filter((p) => p.ownerId === a.id).length;
                const chip = CHIP[a.status] ?? CHIP.pending;
                return (
                  <TableRow key={a.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{a.fullName}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell>{[a.propertyType, a.propertyCity].filter(Boolean).join(', ')}</TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell><Chip size="small" label={chip.label} color={chip.color} /></TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openReview(a)}>
                        {a.status === 'pending' ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} fullWidth maxWidth="md">
        {selected && (
          <>
            <DialogTitle sx={{ color: '#0F4A5F', fontWeight: 600 }}>Host application: {selected.fullName}</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 3 }}>
                <Box>
                  <Detail label="Email">{selected.email}</Detail>
                  <Detail label="Mobile">{selected.phone}</Detail>
                  <Detail label="Home address">{selected.address}</Detail>
                  <Detail label="Government ID type">{selected.idType}</Detail>
                  {selected.idPhoto && (
                    <Box component="img" src={selected.idPhoto} alt="Government ID" sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 2, border: '1px solid #e2e8f0' }} />
                  )}
                </Box>
                <Box>
                  <Detail label="Relationship to property">{selected.role}</Detail>
                  <Detail label="Planned property">
                    {[selected.propertyType, selected.propertyCity].filter(Boolean).join(', ')}
                  </Detail>
                  <Detail label="About the applicant">{selected.about}</Detail>
                  {selected.proofPhoto && (
                    <Box component="img" src={selected.proofPhoto} alt="Proof of ownership or permission" sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 2, border: '1px solid #e2e8f0' }} />
                  )}
                </Box>
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Reason (required when rejecting, shown to the applicant)"
                value={note}
                onChange={(e) => { setNote(e.target.value); setNoteError(false); }}
                error={noteError}
                helperText={noteError ? 'Add a short reason so they know what to fix.' : ' '}
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button color="inherit" onClick={() => setSelected(null)} disabled={busy}>Close</Button>
              <Button color="error" onClick={() => decide(selected, 'rejected')} disabled={busy || selected.status === 'rejected'}>
                Reject
              </Button>
              <Button variant="contained" color="success" onClick={() => decide(selected, 'approved')} disabled={busy || selected.status === 'approved'}>
                Approve
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}