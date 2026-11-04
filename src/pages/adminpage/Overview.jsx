import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import NorthEastOutlinedIcon from '@mui/icons-material/NorthEastOutlined';
import { money } from '../../dataqueries/Booking';
import { PageHeader, StatCard, colors } from './adminUi';
 
const shortcuts = [
  { title: 'User Management', text: 'Manage platform accounts and access.', path: '/admin/users', Icon: PeopleOutlineIcon },
  { title: 'Host Management', text: 'Review host applications and approval status.', path: '/admin/hosts', Icon: HowToRegOutlinedIcon },
  { title: 'Property Management', text: 'Manage listings, rates and visibility.', path: '/admin/properties', Icon: HomeOutlinedIcon },
  { title: 'Reservation Monitoring', text: 'Follow bookings from pending to completed.', path: '/admin/reservations', Icon: CalendarMonthOutlinedIcon },
  { title: 'Review Moderation', text: 'Review guest feedback and host replies.', path: '/admin/reviews', Icon: ChatBubbleOutlineIcon },
  { title: 'Reports & Analytics', text: 'See booking outcomes and platform revenue.', path: '/admin/reports', Icon: BarChartOutlinedIcon },
];
 
export default function Overview({ users, properties, reservations }) {
  const hosts = users.filter((u) => u.isHost || properties.some((p) => p.ownerId === u.id));
  const totalEarnings = reservations
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.total || 0), 0);
 
  return (
    <>
      <PageHeader
        title="Platform Overview"
        subtitle="A clear view of your platform, with every management tool within reach."
      />
 
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard label="Total Accounts" value={users.length} caption="Platform accounts" Icon={PeopleOutlineIcon} />
        <StatCard label="Active Hosts" value={hosts.length} caption="Active hosting accounts" Icon={HowToRegOutlinedIcon} />
        <StatCard label="Listings" value={properties.length} caption="Properties on the platform" Icon={HomeOutlinedIcon} />
        <StatCard
          label="Total Volume"
          value={money(totalEarnings)}
          caption="Confirmed platform revenue"
          Icon={AccountBalanceWalletOutlinedIcon}
        />
      </Box>
 
      <Paper elevation={0} sx={{ bgcolor: '#fff', border: `1px solid ${colors.line}`, borderRadius: '20px', p: 2.75 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 500, color: colors.title }}>Manage your platform</Typography>
        <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5, mb: 2.5 }}>
          Your workspace for day-to-day operations
        </Typography>
 
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>
          {shortcuts.map(({ title, text, path, Icon }) => (
            <Box
              key={title}
              component={RouterLink}
              to={path}
              sx={{
                display: 'block',
                textDecoration: 'none',
                border: `1px solid ${colors.line}`,
                borderRadius: '16px',
                p: 2.25,
                minHeight: 108,
                transition: 'border-color 0.2s, background-color 0.2s',
                '&:hover': { borderColor: colors.primary, bgcolor: '#FAFCFC' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Icon sx={{ fontSize: 20, color: colors.dark }} />
                <NorthEastOutlinedIcon sx={{ fontSize: 16, color: colors.muted }} />
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 500, color: colors.title }}>{title}</Typography>
              <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.75 }}>{text}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </>
  );
}