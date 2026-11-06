import { useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, Link, MenuItem, Paper, Rating, TextField, Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import {
  PAYMENT_LABELS, STATUS_LABELS, money, paymentStatusOf, refundReservation, statusOf,
} from '../dataqueries/Booking';
import { CHARGE_LABELS, reservationCharges, todayISO } from '../dataqueries/Pricing';
import {
  MAX_DAMAGE_PHOTOS, cancelReservation, compressPhoto, confirmReservation, declineReservation, reportDamage,
} from '../dataqueries/Reservation';

const statusStyle = {
  pending: { bgcolor: '#FBF1C0', color: '#6B5200' },
  confirmed: { bgcolor: '#E8F1F4', color: '#2F5E70' },
  declined: { bgcolor: '#EFECEC', color: '#7A7070' },
  cancelled: { bgcolor: '#F8E1DF', color: '#8A2E26' },
  completed: { bgcolor: '#E3EAF7', color: '#27437A' },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'declined', label: 'Declined' },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const guestSummary = (r) => {
  const adults = r.adults ?? r.guests ?? 1;
  const parts = [plural(adults, 'adult')];
  if (r.children) parts.push(`${r.children} ${r.children === 1 ? 'child' : 'children'}`);
  if (r.infants) parts.push(plural(r.infants, 'infant'));
  if (r.pets) parts.push(plural(r.pets, 'pet'));
  return parts.join(', ');
};

const fmt = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const fmtStamp = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const surfaceSx = { bgcolor: '#ffffff', border: '1px solid #E6E3E3', borderRadius: '16px', overflow: 'hidden' };

function Line({ label, value, bold }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography variant="body2" sx={{ color: '#7A7070' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

function Fact({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: '#7A7070', fontWeight: 600, display: 'block' }}>{label}</Typography>
      {children}
    </Box>
  );
}

function RequestCard({ r, conflict, busy, review, onDetails, onConfirm, onDecline, onCancel, onDamage, onReply }) {
  const pending = r.status === 'pending';
  const status = statusOf(r);
  const c = reservationCharges(r);
  const stayEnded = r.status === 'confirmed' && r.checkOut <= todayISO();

  return (
    <Paper elevation={0} sx={{ ...surfaceSx, bgcolor: pending ? '#FFFBE8' : '#fff' }}>
      {/* Top: guest and status */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Avatar sx={{ bgcolor: '#E8F1F4', color: '#2F5E70', fontWeight: 700 }}>
            {(r.guestName || '?').charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{r.guestName}</Typography>
            <Typography variant="body2" sx={{ color: '#7A7070' }} noWrap>
              <Link href={`mailto:${r.guestEmail}`} underline="hover" color="inherit">{r.guestEmail}</Link>
              {r.guestPhone && (
                <>
                  {' · '}
                  <Link href={`tel:${r.guestPhone}`} underline="hover" color="inherit">{r.guestPhone}</Link>
                </>
              )}
            </Typography>
          </Box>
        </Box>
        <Chip size="small" label={STATUS_LABELS[status] ?? r.status} sx={{ fontWeight: 600, ...statusStyle[status] }} />
      </Box>

      <Divider />

      {/* Middle: facts */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: '1.4fr 1.2fr 1fr 1fr' },
          gap: { xs: 2, md: 3 },
          p: 2,
        }}
      >
        <Fact label="Property">
          <Typography sx={{ fontWeight: 600 }} noWrap>{r.propertyTitle}</Typography>
        </Fact>
        <Fact label="Dates">
          <Typography variant="body2">{fmt(r.checkIn)} to {fmt(r.checkOut)}</Typography>
          <Typography variant="body2" sx={{ color: '#7A7070' }}>{plural(c.nights, 'night')}</Typography>
        </Fact>
        <Fact label="Guests">
          <Typography variant="body2">{guestSummary(r)}</Typography>
        </Fact>
        <Fact label="Total">
          <Typography sx={{ fontWeight: 700 }}>{money(c.bookingTotal)}</Typography>
          {(r.status === 'confirmed' || paymentStatusOf(r) !== 'unpaid') && (
            <Typography variant="body2" sx={{ fontWeight: 600, color: paymentStatusOf(r) === 'unpaid' ? '#6B5200' : '#2E6B3F' }}>
              {PAYMENT_LABELS[paymentStatusOf(r)]}
            </Typography>
          )}
        </Fact>
      </Box>

      {(conflict || r.damageStatus || (r.status === 'cancelled' && r.cancellationFee > 0)) && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          {conflict && (
            <Typography variant="body2" sx={{ color: '#8A2E26', fontWeight: 600 }}>
              These dates are already booked or blocked. You can only decline this request.
            </Typography>
          )}
          {r.damageStatus && (
            <Typography variant="body2" sx={{ fontWeight: 600, color: r.damageStatus === 'paid' ? '#2E6B3F' : '#6B5200' }}>
              Damage charge {money(c.damage)}: {CHARGE_LABELS[r.damageStatus]}
            </Typography>
          )}
          {r.status === 'cancelled' && r.cancellationFee > 0 && (
            <Typography variant="body2" sx={{ fontWeight: 600, color: r.cancellationFeeStatus === 'paid' ? '#2E6B3F' : '#6B5200' }}>
              Cancellation fee {money(c.cancellationFee)}: {CHARGE_LABELS[r.cancellationFeeStatus] ?? 'Unpaid'}
            </Typography>
          )}
        </Box>
      )}

      <Divider />

      {/* Bottom: actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={() => onDetails(r)}>View details</Button>
        {pending && (
          <>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<CheckIcon />}
              disabled={conflict || busy}
              onClick={() => onConfirm(r)}
            >
              Confirm
            </Button>
            <Button size="small" color="inherit" startIcon={<CloseIcon />} disabled={busy} onClick={() => onDecline(r)}>
              Decline
            </Button>
          </>
        )}
        {r.status === 'confirmed' && r.checkIn > todayISO() && (
          <Button size="small" color="inherit" disabled={busy} onClick={() => onCancel(r)}>Cancel booking</Button>
        )}
        {stayEnded && !r.damageStatus && (
          <Button size="small" color="warning" onClick={() => onDamage(r)}>Report damage</Button>
        )}
      </Box>

      {/* The guest's review and your reply */}
      {r.status === 'confirmed' && (
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px dashed #E6E3E3' }}>
          {review ? (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: '#7A7070', fontWeight: 600 }}>Review from {r.guestName}</Typography>
                <Rating value={review.rating} readOnly size="small" />
                {review.text && <Typography variant="body2" sx={{ mt: 0.25 }}>{review.text}</Typography>}
                {review.hostReply && (
                  <Typography variant="body2" sx={{ mt: 0.5, color: '#2F5E70' }}>Your reply: {review.hostReply}</Typography>
                )}
              </Box>
              <Button size="small" onClick={() => onReply(review)}>{review.hostReply ? 'Edit reply' : 'Reply'}</Button>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: '#7A7070' }}>No review from this guest yet.</Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default function IncomingGuests({ properties, reservations, reviewsByReservation, onReply, onError, onNotice }) {
  const [propertyId, setPropertyId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [detailsId, setDetailsId] = useState(null);

  // damage dialog
  const [damageFor, setDamageFor] = useState(null);
  const [damage, setDamage] = useState({ amount: '', description: '', photos: [] });
  const [damageError, setDamageError] = useState('');
  const [damageSaving, setDamageSaving] = useState(false);

  const shown = useMemo(
    () =>
      reservations.filter(
        (r) =>
          (propertyId === 'all' || r.propertyId === propertyId) &&
          (statusFilter === 'all' || r.status === statusFilter)
      ),
    [reservations, propertyId, statusFilter]
  );

  const current = detailsId ? reservations.find((r) => r.id === detailsId) ?? null : null;
  const c = current ? reservationCharges(current) : null;

  // A pending request is in conflict once a confirmed booking overlaps it.
  const hasConflict = (r) =>
    r.status === 'pending' &&
    reservations.some(
      (o) =>
        o.id !== r.id &&
        o.propertyId === r.propertyId &&
        o.status === 'confirmed' &&
        o.checkIn < r.checkOut &&
        o.checkOut > r.checkIn
    );

  const handleConfirm = async (r) => {
    setBusyId(r.id);
    try {
      const { declined } = await confirmReservation(r);
      onNotice(
        declined > 0
          ? `Booking confirmed. ${plural(declined, 'other request')} for these dates ${declined === 1 ? 'was' : 'were'} declined and the guests were notified.`
          : 'Booking confirmed.'
      );
    } catch (err) {
      onError(
        err.message === 'overlap'
          ? 'Those dates are not available (already booked or blocked), so this request cannot be confirmed. Decline it, open the dates, or cancel the other booking first.'
          : err.message === 'not-pending'
            ? 'This request was already handled.'
            : 'Could not confirm that reservation.'
      );
    } finally {
      setBusyId('');
    }
  };

  const handleDecline = async (r) => {
    setBusyId(r.id);
    try {
      await declineReservation(r);
    } catch {
      onError('Could not decline that reservation.');
    } finally {
      setBusyId('');
    }
  };

  const handleCancel = async (r) => {
    if (!window.confirm(`Cancel ${r.guestName}'s booking at "${r.propertyTitle}"? The guest will be notified and the dates open up again.`)) return;
    setBusyId(r.id);
    try {
      await cancelReservation(r, 'host');
    } catch {
      onError('Could not cancel that booking. Please try again.');
      setBusyId('');
      return;
    }
    // A paid booking is refunded in full when the host cancels it.
    if (paymentStatusOf(r) === 'paid') {
      try {
        await refundReservation(r);
      } catch {
        onError('The booking was cancelled, but the refund could not be processed. The guest can retry it from My bookings.');
      }
    }
    setBusyId('');
  };

  // ----- damage report -----
  const openDamage = (r) => {
    setDamageFor(r);
    setDamage({ amount: '', description: '', photos: [] });
    setDamageError('');
  };
  const closeDamage = () => {
    if (!damageSaving) setDamageFor(null);
  };
  const addDamagePhotos = async (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    const room = MAX_DAMAGE_PHOTOS - damage.photos.length;
    if (!files.length || room <= 0) return;
    try {
      const added = await Promise.all(files.slice(0, room).map((f) => compressPhoto(f)));
      setDamage((d) => ({ ...d, photos: [...d.photos, ...added] }));
    } catch (err) {
      setDamageError(err.message || 'Could not process that photo.');
    }
  };
  const saveDamage = async () => {
    if (!(Number(damage.amount) > 0)) return setDamageError('Enter the damage amount.');
    if (!damage.description.trim()) return setDamageError('Describe what was damaged.');
    setDamageError('');
    setDamageSaving(true);
    try {
      await reportDamage(damageFor, damage);
      setDamageFor(null);
      onNotice('Damage reported. The guest was notified and can now pay the charge.');
    } catch {
      setDamageError('Could not send the damage report. Please try again.');
    } finally {
      setDamageSaving(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'left' }}>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField select size="small" label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} sx={{ minWidth: 240 }}>
          <MenuItem value="all">All properties</MenuItem>
          {properties.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          {STATUS_FILTERS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
        </TextField>
        <Typography variant="body2" sx={{ color: '#7A7070' }}>
          Showing {shown.length} of {reservations.length}
        </Typography>
        {(propertyId !== 'all' || statusFilter !== 'all') && (
          <Button size="small" onClick={() => { setPropertyId('all'); setStatusFilter('all'); }}>Clear filters</Button>
        )}
      </Box>

      {/* List */}
      {reservations.length === 0 ? (
        <Paper elevation={0} sx={{ ...surfaceSx, px: 3, py: 7, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>No booking requests yet</Typography>
          <Typography sx={{ color: '#7A7070', maxWidth: 420, mx: 'auto' }}>
            When a guest requests one of your places, they will show up here for you to confirm or decline.
          </Typography>
        </Paper>
      ) : shown.length === 0 ? (
        <Paper elevation={0} sx={{ ...surfaceSx, px: 3, py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: '#7A7070' }}>No requests match these filters.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              conflict={hasConflict(r)}
              busy={busyId === r.id}
              review={reviewsByReservation[r.id]}
              onDetails={(x) => setDetailsId(x.id)}
              onConfirm={handleConfirm}
              onDecline={handleDecline}
              onCancel={handleCancel}
              onDamage={openDamage}
              onReply={onReply}
            />
          ))}
        </Box>
      )}

      {/* Details */}
      <Dialog open={Boolean(current)} onClose={() => setDetailsId(null)} fullWidth maxWidth="sm" aria-labelledby="request-title">
        {current && (
          <>
            <DialogTitle id="request-title" sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', color: '#7A7070', fontSize: '1rem', fontWeight: 600 }}>
                <span>Booking request</span>
                <Chip size="small" label={STATUS_LABELS[statusOf(current)] ?? current.status} sx={{ fontWeight: 600, ...statusStyle[statusOf(current)] }} />
              </Box>
              <Divider sx={{ my: 1.5 }} />
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Guest</Typography>
              <Line label="Name" value={current.guestName} />
              <Line label="Email" value={current.guestEmail || 'Not given'} />
              <Line label="Phone" value={current.guestPhone || 'Not given'} />

              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Stay</Typography>
              <Line label="Property" value={current.propertyTitle} />
              <Line label="Check-in" value={fmt(current.checkIn)} />
              <Line label="Check-out" value={fmt(current.checkOut)} />
              <Line label="Nights" value={c.nights} />
              <Line label="Guests" value={guestSummary(current)} />
              {fmtStamp(current.createdAt) && <Line label="Requested on" value={fmtStamp(current.createdAt)} />}

              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Price</Typography>
              <Line label={`${money(c.nightlyRate)} x ${plural(c.nights, 'night')}`} value={money(c.subtotal)} />
              {c.cleaningFee > 0 && <Line label="Cleaning fee" value={money(c.cleaningFee)} />}
              {c.serviceFee > 0 && <Line label={`Service fee (${c.serviceFeePercent}%)`} value={money(c.serviceFee)} />}
              <Line label="Booking total" value={money(c.bookingTotal)} bold />
              {c.cancellationFee > 0 && <Line label="Cancellation fee" value={money(c.cancellationFee)} />}
              {c.damage > 0 && <Line label="Damage charge" value={money(c.damage)} />}
              {(c.cancellationFee > 0 || c.damage > 0) && <Line label="All charges" value={money(c.finalTotal)} bold />}

              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Status</Typography>
              <Line label="Booking" value={STATUS_LABELS[statusOf(current)] ?? current.status} />
              <Line label="Payment" value={PAYMENT_LABELS[paymentStatusOf(current)]} />
              {current.cancellationFeeStatus && (
                <Line label="Cancellation fee" value={CHARGE_LABELS[current.cancellationFeeStatus]} />
              )}
              {current.damageStatus && <Line label="Damage payment" value={CHARGE_LABELS[current.damageStatus]} />}
              <Line label="Reservation ID" value={current.id} />

              {current.status === 'cancelled' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Cancelled by {current.cancelledBy === 'host' ? 'you' : current.cancelledBy === 'admin' ? 'the admin' : 'the guest'}
                  {fmtStamp(current.cancelledAt) ? ` on ${fmtStamp(current.cancelledAt)}` : ''}.
                </Alert>
              )}
              {current.status === 'declined' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {current.declineReason === 'dates_unavailable'
                    ? 'Declined automatically because the dates were given to another guest.'
                    : 'You declined this request.'}
                </Alert>
              )}

              {current.damageStatus && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Damage report</Typography>
                  <Typography variant="body2">{current.damageDescription}</Typography>
                  {(current.damagePhotos ?? []).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      {current.damagePhotos.map((src, i) => (
                        <Box key={i} component="img" src={src} alt={`Damage ${i + 1}`} sx={{ width: 96, height: 72, objectFit: 'cover', borderRadius: '8px', border: '1px solid #E6E3E3' }} />
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button variant="contained" onClick={() => setDetailsId(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Damage report */}
      <Dialog open={Boolean(damageFor)} onClose={closeDamage} fullWidth maxWidth="sm" aria-labelledby="damage-title">
        <DialogTitle id="damage-title" sx={{ textAlign: 'left' }}>Report damage</DialogTitle>
        <DialogContent sx={{ textAlign: 'left' }}>
          {damageFor && (
            <Typography variant="body2" sx={{ color: '#7A7070', mb: 2 }}>
              {damageFor.guestName}, {damageFor.propertyTitle}, {fmt(damageFor.checkIn)} to {fmt(damageFor.checkOut)}
            </Typography>
          )}
          {damageError && <Alert severity="error" sx={{ mb: 2 }}>{damageError}</Alert>}
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Damage amount (PHP)"
            value={damage.amount}
            onChange={(e) => setDamage((d) => ({ ...d, amount: e.target.value }))}
            slotProps={{ htmlInput: { min: 1 } }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="What was damaged?"
            value={damage.description}
            onChange={(e) => setDamage((d) => ({ ...d, description: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
            {damage.photos.map((src, i) => (
              <Box key={i} sx={{ position: 'relative', width: 96, height: 72 }}>
                <Box component="img" src={src} alt={`Damage ${i + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                <IconButton
                  size="small"
                  aria-label="Remove photo"
                  onClick={() => setDamage((d) => ({ ...d, photos: d.photos.filter((_, idx) => idx !== i) }))}
                  sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', p: 0.3, '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
            {damage.photos.length < MAX_DAMAGE_PHOTOS && (
              <Button component="label" variant="outlined" size="small" startIcon={<AddPhotoAlternateIcon />}>
                Add photos (optional)
                <input type="file" accept="image/*" multiple hidden onChange={addDamagePhotos} />
              </Button>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: '#7A7070', display: 'block', mt: 1 }}>
            The guest is notified and must pay this charge. You can report damage once per stay.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={closeDamage} disabled={damageSaving}>Cancel</Button>
          <Button variant="contained" onClick={saveDamage} disabled={damageSaving}>
            {damageSaving ? 'Sending…' : 'Send report'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}