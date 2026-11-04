import { useState } from 'react';
import {
  Alert, Box, Button, ButtonBase, IconButton, MenuItem, Paper, TextField, Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { nightsBetween, todayISO, usePropertyNights } from '../dataqueries/Booking';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_RANGE_DAYS = 366;

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const nextDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

const surfaceSx = { bgcolor: '#fff', border: '1px solid #E6E3E3', borderRadius: '16px', overflow: 'hidden' };

const cellStyle = {
  available: { bgcolor: '#fff', color: '#3F3636', border: '1px solid #E6E3E3', '&:hover': { bgcolor: '#F4F4F4' } },
  reserved: { bgcolor: '#E8F1F4', color: '#2F5E70', border: '1px solid #B9D0D9' },
  blocked: {
    color: '#7A7070',
    border: '1px solid #D5D0D0',
    backgroundImage: 'repeating-linear-gradient(135deg, #EFECEC 0 6px, #E2DEDE 6px 12px)',
    '&:hover': { backgroundImage: 'repeating-linear-gradient(135deg, #E6E2E2 0 6px, #D8D3D3 6px 12px)' },
  },
  past: { bgcolor: '#FAFAFA', color: '#B5AFAF', border: '1px solid #F0EEEE' },
};

function Legend() {
  const items = [
    ['Available', cellStyle.available],
    ['Booked', cellStyle.reserved],
    ['Blocked by you', cellStyle.blocked],
  ];
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
      {items.map(([label, sx]) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 16, height: 16, borderRadius: '4px', ...sx }} />
          <Typography variant="caption">{label}</Typography>
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#E0A800' }} />
        <Typography variant="caption">Pending request</Typography>
      </Box>
    </Box>
  );
}

// Host calendar: see booked nights, block nights you do not want to rent out,
// and open them again. Blocked nights are stored in `bookedNights` like confirmed
// bookings, so guests cannot request them and a request on them cannot be confirmed.
export default function AvailabilityCalendar({ properties, reservations }) {
  const [selectedId, setSelectedId] = useState('');
  const [monthStart, setMonthStart] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const property = properties.find((p) => p.id === selectedId) ?? properties[0];
  const nights = usePropertyNights(property?.id);

  if (!property) {
    return (
      <Paper elevation={0} sx={{ ...surfaceSx, px: 3, py: 7, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>No properties yet</Typography>
        <Typography sx={{ color: '#7A7070' }}>Add a property to manage its availability.</Typography>
      </Paper>
    );
  }

  const today = todayISO();
  const blocked = new Set(nights.filter((n) => n.blocked).map((n) => n.date));

  // Booked nights: confirmed reservations (this also shows older bookings that
  // have no night records), plus any other booked night found in the database.
  const reservedBy = new Map();
  const pending = new Set();
  reservations
    .filter((r) => r.propertyId === property.id)
    .forEach((r) => {
      if (r.status === 'confirmed') nightsBetween(r.checkIn, r.checkOut).forEach((d) => reservedBy.set(d, r.guestName));
      if (r.status === 'pending') nightsBetween(r.checkIn, r.checkOut).forEach((d) => pending.add(d));
    });
  nights.filter((n) => !n.blocked).forEach((n) => {
    if (!reservedBy.has(n.date)) reservedBy.set(n.date, 'Booked');
  });

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = monthStart.getDay();
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (n) => setMonthStart(new Date(year, month + n, 1));

  const stateOf = (iso) => {
    if (reservedBy.has(iso)) return 'reserved';
    if (iso < today) return 'past';
    return blocked.has(iso) ? 'blocked' : 'available';
  };

  const run = async (action, doneMessage) => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await action();
      if (doneMessage) setSuccess(doneMessage);
    } catch {
      setError('Could not update the calendar. A date may have just been booked. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const nightRef = (iso) => doc(db, 'bookedNights', `${property.id}_${iso}`);
  const blockDoc = (iso) => ({ propertyId: property.id, ownerId: property.ownerId, date: iso, blocked: true });

  const toggle = (iso) =>
    run(() => (blocked.has(iso) ? deleteDoc(nightRef(iso)) : setDoc(nightRef(iso), blockDoc(iso))));

  const applyRange = (block) => {
    setError('');
    setSuccess('');
    if (!from || !to || to < from) {
      setError('Choose a start date and an end date that is the same day or later.');
      return;
    }
    const days = nightsBetween(from, nextDay(to));
    if (days.length > MAX_RANGE_DAYS) {
      setError(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
      return;
    }
    const targets = block
      ? days.filter((d) => d >= today && !blocked.has(d) && !reservedBy.has(d))
      : days.filter((d) => blocked.has(d));
    if (targets.length === 0) {
      setError(block ? 'Every date in that range is already booked, blocked or in the past.' : 'None of those dates are blocked.');
      return;
    }
    run(async () => {
      const batch = writeBatch(db);
      targets.forEach((d) => (block ? batch.set(nightRef(d), blockDoc(d)) : batch.delete(nightRef(d))));
      await batch.commit();
    }, block ? `Blocked ${targets.length} night${targets.length === 1 ? '' : 's'}.` : `Opened ${targets.length} night${targets.length === 1 ? '' : 's'}.`);
  };

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          select
          size="small"
          label="Property"
          value={property.id}
          onChange={(e) => setSelectedId(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {properties.map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" sx={{ color: '#7A7070' }}>
          Click an open date to block it. Click a blocked date to open it again.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <IconButton aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeftIcon /></IconButton>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }} aria-live="polite">{monthLabel}</Typography>
          <IconButton aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRightIcon /></IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
          {WEEKDAYS.map((w) => (
            <Typography key={w} variant="caption" sx={{ textAlign: 'center', fontWeight: 600, color: '#7A7070' }}>{w}</Typography>
          ))}
          {Array.from({ length: blanks }, (_, i) => <Box key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const iso = isoOf(year, month, day);
            const state = stateOf(iso);
            const clickable = state === 'available' || state === 'blocked';
            const labels = { available: 'available', blocked: 'blocked', reserved: `booked by ${reservedBy.get(iso)}`, past: 'past' };
            return (
              <ButtonBase
                key={iso}
                disabled={!clickable || busy}
                onClick={() => toggle(iso)}
                aria-label={`${iso}, ${labels[state]}`}
                title={state === 'reserved' ? `Booked: ${reservedBy.get(iso)}` : undefined}
                sx={{
                  position: 'relative',
                  minHeight: { xs: 48, md: 68 },
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  p: 0.75,
                  outline: iso === today ? '2px solid #457B91' : 'none',
                  outlineOffset: -2,
                  ...cellStyle[state],
                  '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' },
                }}
              >
                <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{day}</Typography>
                {state === 'reserved' && (
                  <Typography
                    component="span"
                    noWrap
                    sx={{ fontSize: '0.65rem', maxWidth: '100%', display: { xs: 'none', md: 'block' } }}
                  >
                    {reservedBy.get(iso)}
                  </Typography>
                )}
                {pending.has(iso) && state !== 'reserved' && (
                  <Box
                    aria-hidden="true"
                    sx={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', bgcolor: '#E0A800' }}
                  />
                )}
              </ButtonBase>
            );
          })}
        </Box>

        <Legend />
      </Paper>

      <Paper elevation={0} sx={{ ...surfaceSx, p: 2.5, mt: 2 }}>
        <Typography sx={{ fontWeight: 700 }}>Block or open a range of dates</Typography>
        <Typography variant="body2" sx={{ color: '#7A7070', mb: 1.5 }}>
          Useful for holidays, repairs or your own stays. Booked nights are never changed.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            type="date"
            label="To (included)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }}
          />
          <Button variant="contained" disableElevation disabled={busy} onClick={() => applyRange(true)}>Block dates</Button>
          <Button variant="outlined" disabled={busy} onClick={() => applyRange(false)}>Open dates</Button>
        </Box>
      </Paper>
    </Box>
  );
}