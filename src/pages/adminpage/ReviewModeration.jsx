import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, Rating, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { PageHeader, Panel, StatusPill, TextAction, colors, tableSx } from './adminUi';

const formatDate = (v) => {
  if (!v) return '-';
  const d = v.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
};

export default function ReviewModeration() {
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const [hideTarget, setHideTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
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

  const stats = useMemo(() => {
    const visible = reviews.filter((r) => !r.hidden);
    const total = visible.reduce((sum, r) => sum + (r.rating ?? 0), 0);
    return {
      all: reviews.length,
      low: reviews.filter((r) => (r.rating ?? 0) <= 2).length,
      hidden: reviews.filter((r) => r.hidden).length,
      reported: reviews.filter((r) => r.reported).length,
      replied: reviews.filter((r) => r.hostReply).length,
      noReply: reviews.filter((r) => !r.hostReply).length,
      average: visible.length ? (total / visible.length).toFixed(1) : '-',
    };
  }, [reviews]);

  const filtered = reviews.filter((r) => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'low' && (r.rating ?? 0) <= 2) ||
      (tab === 'hidden' && r.hidden) ||
      (tab === 'reported' && r.reported) ||
      (tab === 'replied' && r.hostReply) ||
      (tab === 'noreply' && !r.hostReply);
    const text = `${r.guestName} ${r.propertyTitle} ${r.text} ${r.hostReply}`.toLowerCase();
    return matchesTab && text.includes(search.toLowerCase());
  });

  const current = selected ? reviews.find((r) => r.id === selected) : null;

  const openHide = (rev) => {
    setReason(rev.reported ? (rev.reportReason ?? '') : '');
    setReasonError(false);
    setHideTarget(rev);
  };

  const confirmHide = async () => {
    if (!hideTarget) return;
    if (!reason.trim()) return setReasonError(true);
    setBusy(true);
    try {
      await updateDoc(doc(db, 'reviews', hideTarget.id), {
        hidden: true,
        hiddenReason: reason.trim(),
        hiddenAt: serverTimestamp(),
        // Hiding a reported review settles the report
        ...(hideTarget.reported ? { reported: false, reportResolvedAt: serverTimestamp() } : {}),
      });
      setSuccess('Review hidden from the public.');
      setHideTarget(null);
    } catch (err) {
      console.error(err);
      setError(`Could not hide review: ${err.code || err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUnhide = async (rev) => {
    try {
      await updateDoc(doc(db, 'reviews', rev.id), {
        hidden: false,
        hiddenReason: '',
        hiddenAt: null,
      });
      setSuccess('Review is visible again.');
    } catch (err) {
      console.error(err);
      setError(`Could not restore review: ${err.code || err.message}`);
    }
  };

  // The review stays public; the report is closed and the host cannot report it again.
  const dismissReport = async (rev) => {
    try {
      await updateDoc(doc(db, 'reviews', rev.id), {
        reported: false,
        reportResolvedAt: serverTimestamp(),
      });
      setSuccess('Report dismissed. The review stays as it is.');
    } catch (err) {
      console.error(err);
      setError(`Could not dismiss report: ${err.code || err.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'reviews', deleteTarget.id));
      setSelected(null);
      setSuccess('Review removed successfully.');
    } catch (err) {
      console.error(err);
      setError(`Could not delete review: ${err.code || err.message}`);
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <PageHeader
        title="Review Moderation"
        subtitle="Check guest reviews and host replies. Hide anything that breaks the rules."
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 2, mb: 2 }}>
        <Stat label="Total reviews" value={stats.all} />
        <Stat label="Average rating" value={stats.average} />
        <Stat label="Low rated (1-2)" value={stats.low} />
        <Stat label="Reported by hosts" value={stats.reported} />
        <Stat label="Hidden" value={stats.hidden} />
      </Box>

      <Panel
        title="Guest reviews"
        subtitle="Comments and host replies"
        footer={`Showing ${filtered.length} of ${reviews.length} reviews`}
        action={
          <TextField
            size="small"
            placeholder="Search reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon sx={{ fontSize: 18, color: colors.muted }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: { xs: 180, sm: 265 },
              '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14, bgcolor: '#fff' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.line },
            }}
          />
        }
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          sx={{ px: 2, borderBottom: `1px solid ${colors.line}` }}
        >
          <Tab value="all" label={`All (${stats.all})`} />
          <Tab value="reported" label={`Reported (${stats.reported})`} />
          <Tab value="low" label={`Low rated (${stats.low})`} />
          <Tab value="hidden" label={`Hidden (${stats.hidden})`} />
          <Tab value="replied" label={`Replied (${stats.replied})`} />
          <Tab value="noreply" label={`No reply (${stats.noReply})`} />
        </Tabs>

        <TableContainer>
          <Table sx={{ ...tableSx, '& .MuiTableBody-root .MuiTableRow-root': { height: 96 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Author</TableCell>
                <TableCell>Property</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Moderate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No reviews found.</TableCell></TableRow>
              ) : (
                filtered.map((rev) => (
                  <TableRow key={rev.id}>
                    <TableCell>
                      <Typography sx={{ fontSize: 14 }}>{rev.guestName || 'Anonymous'}</Typography>
                      <Typography sx={{ fontSize: 12, color: colors.muted }}>{formatDate(rev.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>{rev.propertyTitle || '-'}</TableCell>
                    <TableCell>
                      <Rating value={rev.rating ?? 0} readOnly size="small" sx={{ color: '#F5A800' }} />
                      <Typography sx={{ fontSize: 12, color: colors.muted }}>{rev.rating ?? 0} out of 5</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography
                        sx={{
                          fontSize: 14,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {rev.text || <em>No comment</em>}
                      </Typography>
                      {rev.hostReply && (
                        <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5 }}>
                          Host replied
                        </Typography>
                      )}
                      {rev.reported && (
                        <Typography sx={{ fontSize: 12, color: colors.danger, mt: 0.5 }}>
                          Reported: {rev.reportReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'start' }}>
                        <StatusPill
                          label={rev.hidden ? 'Hidden' : 'Visible'}
                          variant={rev.hidden ? 'disabled' : 'active'}
                        />
                        {rev.reported && <StatusPill label="Reported" variant="pending" />}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
                        <TextAction onClick={() => setSelected(rev.id)}>View</TextAction>
                        {rev.reported && <TextAction onClick={() => dismissReport(rev)}>Dismiss</TextAction>}
                        <TextAction onClick={() => (rev.hidden ? handleUnhide(rev) : openHide(rev))}>
                          {rev.hidden ? 'Restore' : 'Hide'}
                        </TextAction>
                        <Button
                          size="small"
                          onClick={() => setDeleteTarget(rev)}
                          startIcon={<DeleteOutlineIcon sx={{ fontSize: '18px !important' }} />}
                          sx={{ color: colors.danger, fontSize: 14, fontWeight: 500 }}
                        >
                          Remove
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>

      {/* View dialog */}
      <Dialog open={Boolean(current)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        {current && (
          <>
            <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
              Review by {current.guestName || 'Anonymous'}
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Detail label="Property" value={current.propertyTitle} />
                <Box>
                  <Typography sx={{ fontSize: 12, color: colors.muted }}>Rating</Typography>
                  <Rating value={current.rating ?? 0} readOnly size="small" sx={{ color: '#F5A800' }} />
                </Box>
                <Detail label="Comment" value={current.text} pre />
                <Detail label="Host reply" value={current.hostReply} pre />
                <Detail label="Posted" value={formatDate(current.createdAt)} />
                <Detail label="Status" value={current.hidden ? 'Hidden' : 'Visible'} />
                {current.hidden && <Detail label="Reason hidden" value={current.hiddenReason} pre />}
                {current.reported && (
                  <>
                    <Detail label="Reported by the host" value={formatDate(current.reportedAt)} />
                    <Detail label="Host's reason" value={current.reportReason} pre />
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              {current.reported && (
                <Button onClick={() => dismissReport(current)}>Dismiss report</Button>
              )}
              <Button
                onClick={() => {
                  if (current.hidden) {
                    handleUnhide(current);
                  } else {
                    const rev = current;
                    setSelected(null);
                    openHide(rev);
                  }
                }}
              >
                {current.hidden ? 'Restore review' : 'Hide review'}
              </Button>
              <Button color="error" onClick={() => setDeleteTarget(current)}>Remove</Button>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Hide dialog */}
      <Dialog open={Boolean(hideTarget)} onClose={() => !busy && setHideTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
          Hide this review?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: colors.muted, mb: 2 }}>
            Guests will no longer see it. You can restore it later.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Reason (required)"
            placeholder="Example: Offensive language, fake review, personal info..."
            value={reason}
            onChange={(e) => { setReason(e.target.value); setReasonError(false); }}
            error={reasonError}
            helperText={reasonError ? 'Add a short reason for your records.' : ' '}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHideTarget(null)} disabled={busy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmHide} disabled={busy}>
            {busy ? 'Hiding...' : 'Hide review'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
          Remove this review?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: colors.muted }}>
            This deletes the review for good. You cannot undo it.
            If you only want to take it off the public page, use Hide instead.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={busy}>
            {busy ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${colors.line}`, borderRadius: '12px', p: 2 }}>
      <Typography sx={{ fontSize: 12, color: colors.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

function Detail({ label, value, pre }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: colors.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, whiteSpace: pre ? 'pre-wrap' : 'normal' }}>{value || '-'}</Typography>
    </Box>
  );
}