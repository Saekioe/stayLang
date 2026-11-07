import { useMemo, useState } from 'react';
import { Box, Button, Chip, MenuItem, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import { GUEST_TABS, bucketOf, countGuests, filterGuests, sortGuests } from '../dataqueries/GuestBuckets';
import IncomingGuests from './IncomingGuests';

const surfaceSx = { bgcolor: '#fff', border: '1px solid #E6E3E3', borderRadius: '16px', overflow: 'hidden' };

const EMPTY_FILTERS = { query: '', propertyId: 'all', stage: 'all', status: 'all', from: '', to: '' };

const STAGES = [
  { value: 'all', label: 'Staying and arriving' },
  { value: 'staying', label: 'Staying now' },
  { value: 'arriving', label: 'Arriving soon' },
];
const OUTCOMES = [
  { value: 'all', label: 'All outcomes' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

const HELP = {
  incoming: 'Booking requests waiting for your reply. They leave this list as soon as you confirm or decline.',
  current: 'Confirmed guests who are staying now or arriving soon, until check-out.',
  archived: 'Completed, declined and cancelled bookings. Nothing is deleted.',
};
const EMPTY = {
  incoming: ['No requests waiting', 'New booking requests show up here until you confirm or decline them.'],
  current: ['No current guests', 'Confirmed bookings stay here until the guest checks out.'],
  archived: ['No archived guests yet', 'Completed, declined and cancelled bookings are kept here.'],
};

const dateFieldProps = { inputLabel: { shrink: true } };

export default function GuestManagement({
  value, onChange, properties, reservations, reviewsByReservation, onReply, onError, onNotice,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Counts, lists and filters all come from the live reservations, so they update the moment a status changes.
  const counts = useMemo(() => countGuests(reservations), [reservations]);
  const inBucket = useMemo(() => reservations.filter((r) => bucketOf(r) === value), [reservations, value]);
  const list = useMemo(
    () =>
      sortGuests(
        filterGuests(inBucket, {
          ...filters,
          // these two only exist in their own section, so they never filter another one
          stage: value === 'current' ? filters.stage : 'all',
          status: value === 'archived' ? filters.status : 'all',
        }),
        value
      ),
    [inBucket, filters, value]
  );

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const changeTab = (_, next) => {
    setFilters((f) => ({ ...f, stage: 'all', status: 'all' }));
    onChange(next);
  };

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Tabs
        value={value}
        onChange={changeTab}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1, minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40 } }}
      >
        {GUEST_TABS.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t.label}
                <Chip
                  size="small"
                  label={counts[t.key]}
                  sx={{
                    height: 20,
                    fontWeight: 700,
                    bgcolor: t.key === 'incoming' && counts.incoming > 0 ? '#FBF1C0' : '#EFECEC',
                    color: t.key === 'incoming' && counts.incoming > 0 ? '#6B5200' : '#7A7070',
                  }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>
      <Typography variant="body2" sx={{ color: '#7A7070', mb: 2 }}>{HELP[value]}</Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(auto-fit, minmax(170px, 1fr))' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <TextField size="small" label="Search guest, email or property" value={filters.query} onChange={setFilter('query')} />
        <TextField select size="small" label="Property" value={filters.propertyId} onChange={setFilter('propertyId')}>
          <MenuItem value="all">All properties</MenuItem>
          {properties.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
        </TextField>
        {value === 'current' && (
          <TextField select size="small" label="Stay" value={filters.stage} onChange={setFilter('stage')}>
            {STAGES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </TextField>
        )}
        {value === 'archived' && (
          <TextField select size="small" label="Outcome" value={filters.status} onChange={setFilter('status')}>
            {OUTCOMES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </TextField>
        )}
        <TextField size="small" type="date" label="Stay from" value={filters.from} onChange={setFilter('from')} slotProps={dateFieldProps} />
        <TextField size="small" type="date" label="Stay until" value={filters.to} onChange={setFilter('to')} slotProps={dateFieldProps} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, minHeight: 30 }}>
        <Typography variant="body2" sx={{ color: '#7A7070' }}>
          Showing {list.length} of {inBucket.length}
        </Typography>
        {filtered && <Button size="small" onClick={clearFilters}>Clear filters</Button>}
      </Box>

      {inBucket.length === 0 ? (
        <Paper elevation={0} sx={{ ...surfaceSx, px: 3, py: 7, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{EMPTY[value][0]}</Typography>
          <Typography sx={{ color: '#7A7070', maxWidth: 420, mx: 'auto' }}>{EMPTY[value][1]}</Typography>
        </Paper>
      ) : list.length === 0 ? (
        <Paper elevation={0} sx={{ ...surfaceSx, px: 3, py: 6, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '1.25rem', mb: 1 }}>No guests match these filters</Typography>
          <Button onClick={clearFilters}>Clear filters</Button>
        </Paper>
      ) : (
        <IncomingGuests
          properties={properties}
          reservations={list}
          reviewsByReservation={reviewsByReservation}
          onReply={onReply}
          onError={onError}
          onNotice={onNotice}
        />
      )}
    </Box>
  );
}