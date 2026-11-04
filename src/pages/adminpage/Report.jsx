import { useEffect, useState } from 'react';
import { Alert, Box, Divider, Paper, Typography } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { money } from '../../dataqueries/Booking';
import { PageHeader, StatCard, colors } from './adminUi';
 
const RED = '#D32F2F';
 
function Legend({ color, label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color }} />
      <Typography sx={{ fontSize: 12, color: colors.muted }}>{label}</Typography>
    </Box>
  );
}
 
function BarRow({ label, value, max, color }) {
  const width = max > 0 ? (value / max) * 85 : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
      <Typography sx={{ width: { xs: 110, md: 165 }, fontSize: 13, color: colors.body, flexShrink: 0 }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 28, borderRadius: '6px', bgcolor: '#F8F9FB', overflow: 'hidden' }}>
        <Box sx={{ width: `${width}%`, height: '100%', bgcolor: color, borderRadius: '6px' }} />
      </Box>
      <Typography sx={{ width: 24, fontSize: 14, color: colors.body }}>{value}</Typography>
    </Box>
  );
}
 
export default function Report() {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');
 
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reservations'), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream reservations.'));
    return unsub;
  }, []);
 
  const confirmed = reservations.filter((r) => r.status === 'confirmed');
  const totalEarnings = confirmed.reduce((sum, r) => sum + (r.total || 0), 0);
  const cancelledCount = reservations.filter((r) => r.status === 'declined' || r.status === 'cancelled').length;
  const max = Math.max(confirmed.length, cancelledCount);
 
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
 
      <PageHeader title="Reports & Analytics" subtitle="Understand booking outcomes and confirmed platform revenue." />
 
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard
          label="Confirmed platform revenue"
          value={money(totalEarnings)}
          valueColor="#2E7D32"
          caption="Total confirmed platform revenue"
          Icon={AccountBalanceWalletOutlinedIcon}
        />
        <StatCard
          label="Confirmed Stays"
          value={confirmed.length}
          caption="Confirmed reservations"
          Icon={EventAvailableOutlinedIcon}
        />
        <StatCard
          label="Cancelled/Declined"
          value={cancelledCount}
          caption="Cancelled or declined reservations"
          Icon={EventBusyOutlinedIcon}
        />
      </Box>
 
      <Paper elevation={0} sx={{ bgcolor: '#fff', border: `1px solid ${colors.line}`, borderRadius: '20px', p: 2.75 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 500, color: colors.title }}>Booking Volume Summary</Typography>
        <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5, mb: 2.5 }}>
          A comparison of the reported reservation outcomes
        </Typography>
 
        <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
          <Legend color={colors.dark} label="Confirmed Stays" />
          <Legend color={RED} label="Cancelled/Declined" />
        </Box>
 
        <BarRow label="Confirmed Stays" value={confirmed.length} max={max} color={colors.dark} />
        <BarRow label="Cancelled/Declined" value={cancelledCount} max={max} color={RED} />
 
        <Divider sx={{ my: 2.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: colors.muted }} />
          <Typography sx={{ fontSize: 13, color: colors.link }}>
            Total confirmed platform revenue stands at {money(totalEarnings)}.
          </Typography>
        </Box>
      </Paper>
    </>
  );
}