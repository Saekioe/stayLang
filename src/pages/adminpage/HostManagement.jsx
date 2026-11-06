import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import NorthEastOutlinedIcon from '@mui/icons-material/NorthEastOutlined';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { PageHeader, Panel, StatusPill, colors, tableSx } from './adminUi';
 
const STATUS = {
  pending: { label: 'Pending', variant: 'pending' },
  approved: { label: 'Approved', variant: 'approved' },
  rejected: { label: 'Rejected', variant: 'rejected' },
};
 
function Detail({ label, children }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 12, color: colors.muted, fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, color: '#000', whiteSpace: 'pre-wrap' }}>{children || 'Not provided'}</Typography>
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
    const deactivating = !approved && app.status === 'approved';
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
      setSuccess(
        approved
          ? 'Host approved. They can now publish listings.'
          : deactivating
            ? 'Host deactivated. Their listings are hidden from guests.'
            : 'Application rejected.'
      );
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
 
      <PageHeader title="Host Management" subtitle="Review host applications, proposed properties and approval status." />
 
      <Panel
        title="Host Approvals & Status"
        subtitle="Applicants and their proposed listings"
        footer={`Showing all ${rows.length} host applicant${rows.length === 1 ? '' : 's'}`}
      >
        <TableContainer>
          <Table sx={{ ...tableSx, '& .MuiTableBody-root .MuiTableRow-root': { height: 79 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Applicant</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Planned property</TableCell>
                <TableCell>Listings</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Review</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No host applications yet.</TableCell></TableRow>
              ) : (
                rows.map((a) => {
                  const count = properties.filter((p) => p.ownerId === a.id).length;
                  const status = STATUS[a.status] ?? STATUS.pending;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{a.fullName}</TableCell>
                      <TableCell sx={{ color: `${colors.link} !important` }}>{a.email}</TableCell>
                      <TableCell>{[a.propertyType, a.propertyCity].filter(Boolean).join(', ')}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell><StatusPill label={status.label} variant={status.variant} /></TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openReview(a)}
                          startIcon={<NorthEastOutlinedIcon sx={{ fontSize: '16px !important' }} />}
                          sx={{
                            color: colors.title, borderColor: colors.line, borderRadius: '8px',
                            fontWeight: 700, fontSize: 14, px: 1.75, bgcolor: '#fff',
                            '&:hover': { borderColor: colors.primary, bgcolor: '#fff' },
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
 
      <Dialog
        open={Boolean(selected)}
        onClose={() => !busy && setSelected(null)}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { sx: { color: '#000' } } }}
      >
        {selected && (
          <>
            <DialogTitle sx={{ color: '#000', fontWeight: 700 }}>Host application: {selected.fullName}</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 3 }}>
                <Box>
                  <Detail label="Email">{selected.email}</Detail>
                  <Detail label="Mobile">{selected.phone}</Detail>
                  <Detail label="Home address">{selected.address}</Detail>
                  <Detail label="Government ID type">{selected.idType}</Detail>
                  {selected.idPhoto && (
                    <Box component="img" src={selected.idPhoto} alt="Government ID" sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 2, border: `1px solid ${colors.line}` }} />
                  )}
                </Box>
                <Box>
                  <Detail label="Relationship to property">{selected.role}</Detail>
                  <Detail label="Planned property">
                    {[selected.propertyType, selected.propertyCity].filter(Boolean).join(', ')}
                  </Detail>
                  <Detail label="About the applicant">{selected.about}</Detail>
                  {selected.proofPhoto && (
                    <Box component="img" src={selected.proofPhoto} alt="Proof of ownership or permission" sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 2, border: `1px solid ${colors.line}` }} />
                  )}
                </Box>
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={`Reason (required when ${selected.status === 'approved' ? 'deactivating' : 'rejecting'}, shown to the host)`}
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
                {selected.status === 'approved' ? 'Deactivate host' : 'Reject'}
              </Button>
              <Button variant="contained" color="success" onClick={() => decide(selected, 'approved')} disabled={busy || selected.status === 'approved'}>
                {selected.status === 'rejected' ? 'Approve again' : 'Approve'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}