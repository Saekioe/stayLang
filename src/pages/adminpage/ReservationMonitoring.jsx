import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  collection, doc, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { STATUS_LABELS, money, statusOf } from '../../dataqueries/Booking';
import {
  PageHeader, Panel, StatusPill, TextAction, colors, tableSx,
} from './adminUi';

// Today in Philippine time, as YYYY-MM-DD (same format as checkIn/checkOut)
const todayPH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const toDate = (v) => {
  try { return v?.toDate ? v.toDate() : v ? new Date(v) : null; } catch { return null; }
};
const fmtDateTime = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

const nightsBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
};

// Every night of the stay (check-out night is not booked): YYYY-MM-DD list
const stayDates = (checkIn, checkOut) => {
  const out = [];
  const d = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

// Problems an admin should look at
function getFlags(r, today) {
  const flags = [];
  const ageHours = toDate(r.createdAt) ? (Date.now() - toDate(r.createdAt).getTime()) / 36e5 : 0;
  if (r.status === 'pending' && r.checkIn && r.checkIn < today) {
    flags.push({ key: 'stale', label: 'Pending past check-in', color: 'error' });
  } else if (r.status === 'pending' && ageHours >= 48) {
    flags.push({ key: 'slow', label: 'Host slow to respond (48h+)', color: 'warning' });
  }
  if (r.status === 'confirmed' && r.paymentStatus === 'unpaid' && r.checkIn && r.checkIn <= today) {
    flags.push({ key: 'unpaid', label: 'Unpaid at check-in', color: 'warning' });
  }
  if (r.status === 'cancelled' && r.cancelledBy === 'host') {
    flags.push({ key: 'hostcancel', label: 'Cancelled by host', color: 'warning' });
  }
  return flags;
}

function Stat({ label, value, tone }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140, p: 2, borderRadius: '12px', border: '1px solid #E5E7EB', bgcolor: '#fff' }}>
      <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 600, color: tone || '#111827' }}>{value}</Typography>
    </Box>
  );
}

function Info({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}

function ReservationDialog({ reservation: r, flags, onClose, onAdminCancel }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const nights = r.nights || nightsBetween(r.checkIn, r.checkOut);
  const canCancel = ['pending', 'confirmed'].includes(r.status);

  const submit = async () => {
    setBusy(true);
    await onAdminCancel(r, reason);
    setBusy(false);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#111827' }}>
        Reservation details
        <StatusPill label={STATUS_LABELS[statusOf(r)] ?? r.status} variant={statusOf(r)} />
      </DialogTitle>
      <DialogContent dividers>
        {flags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {flags.map((f) => <Chip key={f.key} size="small" color={f.color} label={f.label} />)}
          </Box>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <Info label="Guest" value={r.guestName} />
          <Info label="Host" value={r.ownerName || r.ownerId} />
          <Info label="Property" value={r.propertyTitle} />
          <Info label="Guests" value={r.guests} />
          <Info label="Check-in" value={r.checkIn} />
          <Info label="Check-out" value={r.checkOut} />
          <Info label="Nights" value={nights || ''} />
          <Info label="Total" value={money(r.total)} />
          <Info label="Payment status" value={r.paymentStatus} />
          <Info label="Booked on" value={fmtDateTime(r.createdAt)} />
          {r.status === 'cancelled' && (
            <>
              <Info label="Cancelled by" value={r.cancelledBy} />
              <Info label="Cancelled at" value={fmtDateTime(r.cancelledAt)} />
              <Info label="Cancel reason" value={r.cancelReason} />
            </>
          )}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>Reservation ID: {r.id}</Typography>

        {canCancel && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Admin intervention</Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1.5 }}>
              Cancelling frees the booked nights, and the guest and host are notified.
              Use this for disputes, fraud or abandoned reservations.
            </Typography>
            <TextField
              label="Reason (shared with guest and host)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              size="small" fullWidth multiline minRows={2}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
        {canCancel && (
          <Button color="error" variant="contained" disabled={busy || !reason.trim()} onClick={submit}>
            Cancel reservation
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function ReservationMonitoring() {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reservations'), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream reservations.'));
    return unsub;
  }, []);

  const today = todayPH();

  // Status options come from the data, so they always match statusOf()
  const statusOptions = useMemo(
    () => [...new Set(reservations.map((r) => statusOf(r)))].sort(),
    [reservations],
  );

  const flagsById = useMemo(() => {
    const m = {};
    reservations.forEach((r) => { m[r.id] = getFlags(r, today); });
    return m;
  }, [reservations, today]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = reservations.filter((r) => {
      if (q && !`${r.guestName || ''} ${r.propertyTitle || ''} ${r.ownerName || ''} ${r.id}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all' && statusOf(r) !== statusFilter) return false;
      if (paymentFilter !== 'all' && (r.paymentStatus || 'unpaid') !== paymentFilter) return false;
      if (flaggedOnly && flagsById[r.id].length === 0) return false;
      if (from && (r.checkIn || '') < from) return false;
      if (to && (r.checkIn || '') > to) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === 'total') return (b.total || 0) - (a.total || 0);
      if (sort === 'checkin') return (a.checkIn || '').localeCompare(b.checkIn || '');
      const ta = toDate(a.createdAt)?.getTime() || 0;
      const tb = toDate(b.createdAt)?.getTime() || 0;
      return tb - ta || (b.checkIn || '').localeCompare(a.checkIn || '');
    });
  }, [reservations, search, statusFilter, paymentFilter, flaggedOnly, from, to, sort, flagsById]);

  useEffect(() => { setPage(0); }, [search, statusFilter, paymentFilter, flaggedOnly, from, to, sort]);

  // Dashboard numbers (all reservations, not just the filtered ones)
  const summary = useMemo(() => {
    const by = (s) => reservations.filter((r) => r.status === s);
    const confirmed = by('confirmed');
    const cancelled = by('cancelled');
    const declined = by('declined');
    return {
      total: reservations.length,
      pending: by('pending').length,
      confirmed: confirmed.length,
      revenue: confirmed.reduce((s, r) => s + (Number(r.total) || 0), 0),
      lostRate: reservations.length
        ? Math.round(((cancelled.length + declined.length) / reservations.length) * 100) : 0,
      flagged: reservations.filter((r) => flagsById[r.id]?.length).length,
    };
  }, [reservations, flagsById]);

  // Hosts who decline or cancel the most
  const riskyHosts = useMemo(() => {
    const m = {};
    reservations.forEach((r) => {
      const key = r.ownerId || 'unknown';
      m[key] ||= { name: r.ownerName || key, total: 0, bad: 0 };
      m[key].total += 1;
      if (r.status === 'declined' || (r.status === 'cancelled' && r.cancelledBy === 'host')) m[key].bad += 1;
    });
    return Object.values(m).filter((h) => h.bad > 0).sort((a, b) => b.bad - a.bad).slice(0, 5);
  }, [reservations]);

  const selected = reservations.find((r) => r.id === selectedId) || null;

  // Admin cancel: marks cancelled, frees bookedNights, notifies guest + host (one atomic batch)
  const handleAdminCancel = async (r, reason) => {
    if (!window.confirm(`Cancel reservation for ${r.guestName} at "${r.propertyTitle}"?`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'reservations', r.id), {
        status: 'cancelled',
        cancelledBy: 'admin',
        cancelledAt: serverTimestamp(),
        cancelReason: reason.trim(),
      });
      stayDates(r.checkIn, r.checkOut).forEach((date) => {
        batch.delete(doc(db, 'bookedNights', `${r.propertyId}_${date}`));
      });
      [r.guestId, r.ownerId].filter(Boolean).forEach((userId) => {
        batch.set(doc(collection(db, 'notifications')), {
          userId,
          // Same shape as the other notifications, so the inbox can describe it properly
          recipient: userId === r.ownerId ? 'host' : 'guest',
          reservationId: r.id,
          propertyId: r.propertyId ?? null,
          propertyTitle: r.propertyTitle ?? '',
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          nights: r.nights || nightsBetween(r.checkIn, r.checkOut),
          total: r.total ?? 0,
          type: 'reservation_cancelled',
          cancelledBy: 'admin',
          reason: reason.trim(),
          message: `Admin cancelled the reservation at ${r.propertyTitle} (${r.checkIn} to ${r.checkOut}). Reason: ${reason.trim()}`,
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setSelectedId(null);
      setSuccess('Reservation cancelled and both parties notified.');
    } catch {
      setError('Could not cancel the reservation. Check that the admin Firestore rules were added.');
    }
  };

  const exportCsv = () => {
    const head = ['ID', 'Guest', 'Host', 'Property', 'Check-in', 'Check-out', 'Nights', 'Total', 'Status', 'Payment', 'Flags'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [
      r.id, r.guestName, r.ownerName || r.ownerId, r.propertyTitle, r.checkIn, r.checkOut,
      r.nights || nightsBetween(r.checkIn, r.checkOut), r.total, STATUS_LABELS[statusOf(r)] ?? r.status,
      r.paymentStatus, flagsById[r.id].map((f) => f.label).join('; '),
    ].map(esc).join(','));
    const blob = new Blob([[head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reservations-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pageRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <PageHeader
        title="Reservation Monitoring"
        subtitle="Monitor platform reservations, spot problems early and step in when needed."
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Stat label="Total reservations" value={summary.total} />
        <Stat label="Pending" value={summary.pending} />
        <Stat label="Confirmed" value={summary.confirmed} />
        <Stat label="Confirmed value (PHP)" value={money(summary.revenue)} />
        <Stat label="Declined + cancelled" value={`${summary.lostRate}%`} tone={summary.lostRate >= 30 ? '#B45309' : undefined} />
        <Stat label="Needs attention" value={summary.flagged} tone={summary.flagged ? '#B91C1C' : undefined} />
      </Box>

      <Panel
        title="Platform Reservations"
        subtitle="Search, filter and open any reservation"
        footer={`Showing ${rows.length} of ${reservations.length} reservations · Amounts in PHP`}
      >
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', p: 2, alignItems: 'center' }}>
          <TextField size="small" label="Search guest, property, ID" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All statuses</MenuItem>
            {statusOptions.map((s) => <MenuItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Payment" value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="unpaid">Unpaid</MenuItem>
          </TextField>
          <TextField select size="small" label="Sort by" value={sort}
            onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="newest">Newest booked</MenuItem>
            <MenuItem value="checkin">Check-in date</MenuItem>
            <MenuItem value="total">Highest total</MenuItem>
          </TextField>
          <Chip
            label="Needs attention only"
            color={flaggedOnly ? 'warning' : 'default'}
            variant={flaggedOnly ? 'filled' : 'outlined'}
            onClick={() => setFlaggedOnly((v) => !v)}
          />
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </Button>
        </Box>

        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Guest</TableCell>
                <TableCell>Property</TableCell>
                <TableCell>Dates · Check-in → Check-out</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell>Controls</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No reservations found.</TableCell></TableRow>
              ) : (
                pageRows.map((r) => {
                  const status = statusOf(r);
                  const flags = flagsById[r.id] || [];
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
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {flags.length === 0
                            ? <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>None</Typography>
                            : flags.map((f) => <Chip key={f.key} size="small" color={f.color} label={f.label} />)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TextAction width={96} Icon={InfoOutlinedIcon} onClick={() => setSelectedId(r.id)}>
                          Details
                        </TextAction>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Panel>

      <Box sx={{ mt: 2 }}>
        <Panel
          title="Hosts to watch"
          subtitle="Hosts who decline or cancel the most reservations"
          footer="Declined + cancelled by host, out of all their reservations"
        >
          <Box sx={{ p: 2 }}>
            {riskyHosts.length === 0 ? (
              <Typography sx={{ fontSize: 14, color: '#6B7280' }}>No host declines or cancellations yet.</Typography>
            ) : riskyHosts.map((h) => (
              <Box key={h.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
                <Typography sx={{ fontSize: 14 }}>{h.name}</Typography>
                <Typography sx={{ fontSize: 14, color: '#B45309' }}>
                  {h.bad} of {h.total} ({Math.round((h.bad / h.total) * 100)}%)
                </Typography>
              </Box>
            ))}
          </Box>
        </Panel>
      </Box>

      <ReservationDialog
        reservation={selected}
        flags={selected ? flagsById[selected.id] || [] : []}
        onClose={() => setSelectedId(null)}
        onAdminCancel={handleAdminCancel}
      />
    </>
  );
}