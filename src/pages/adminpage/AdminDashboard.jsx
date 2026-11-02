import { useEffect, useState } from 'react';
import {
  Link as RouterLink, Navigate, Route, Routes, useLocation, useNavigate,
} from 'react-router-dom';
import {
  Alert, AppBar, Box, Button, CircularProgress, Divider, Drawer, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Toolbar, Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../auth/Auth';
import { money } from '../../dataqueries/Booking';

import UserManagement from './UserManagement';
import HostManagement from './HostManagement';
import PropertyManagement from './PropertyManagement';
import ReservationMonitoring from './ReservationMonitoring';
import ReviewModeration from './ReviewModeration';
import Report from './Report';
import Settings from './Settings';

const ADMIN_EMAILS = ['admin@staylang.com'];
const NAV_HEIGHT = 72;
const BASE = '/admin';

const menuItems = [
  { label: 'Overview', path: BASE, icon: <DashboardIcon /> },
  { label: 'User Management', path: `${BASE}/users`, icon: <PeopleIcon /> },
  { label: 'Host Management', path: `${BASE}/hosts`, icon: <SupervisorAccountIcon /> },
  { label: 'Property Management', path: `${BASE}/properties`, icon: <HomeWorkIcon /> },
  { label: 'Reservation Monitoring', path: `${BASE}/reservations`, icon: <BookOnlineIcon /> },
  { label: 'Review Moderation', path: `${BASE}/reviews`, icon: <RateReviewIcon /> },
  { label: 'Reports', path: `${BASE}/reports`, icon: <AssessmentIcon /> },
  { label: 'Settings', path: `${BASE}/settings`, icon: <SettingsIcon /> },
];

function Overview({ users, properties, reservations }) {
  const hosts = users.filter((u) => u.isHost || properties.some((p) => p.ownerId === u.id));
  const totalEarnings = reservations
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.total || 0), 0);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#0F172A' }}>Platform Overview</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
          <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>Total Accounts</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#0F172A' }}>{users.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
          <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>Active Hosts</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#0F172A' }}>{hosts.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
          <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>Listings</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#0F172A' }}>{properties.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
          <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>Total Volume</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#16A34A' }}>{money(totalEarnings)}</Typography>
        </Paper>
      </Box>
    </Box>
  );
}

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Firestore collections state (used by the Overview)
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);

  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream users.'));

    const unsubProps = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream properties.'));

    const unsubRes = onSnapshot(collection(db, 'reservations'), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream reservations.'));

    return () => {
      unsubUsers();
      unsubProps();
      unsubRes();
    };
  }, [user]);

  const isActive = (path) => (path === BASE ? pathname === BASE : pathname.startsWith(path));

  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      }
      navigate('/login');
    } catch {
      setError('Failed to log out.');
    }
  };

  // Access Control Guard
  if (loading) return <Box sx={{ py: 12, textAlign: 'center' }}><CircularProgress sx={{ color: '#1E3A8A' }} /></Box>;
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box sx={{ bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      {/* Top Navigation Bar */}
      <AppBar position="fixed" elevation={0} sx={{ backgroundColor: '#FFFFFF', color: '#0F172A', borderBottom: '1px solid #E2E8F0' }}>
        <Toolbar sx={{ px: { xs: 2, md: 6 }, minHeight: NAV_HEIGHT, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <IconButton
              color="inherit"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { lg: 'none' }, mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: '#457B91', lineHeight: 1.2 }}>
                StayLang
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', lineHeight: 1, fontWeight: 500 }}>
                Admin Control Panel
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, display: { lg: 'none' } }} />

          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{
              borderRadius: 99,
              px: 2.5,
              py: 0.75,
              fontWeight: 600,
              fontSize: '0.875rem',
              flexShrink: 0,
              color: '#457B91',
              border: '1px solid #CBD5E1',
              '&:hover': { bgcolor: '#F1F5F9', borderColor: '#457B91' },
            }}
          >
            Logout
          </Button>
        </Toolbar>

        {/* Mobile drawer */}
        <Drawer anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)}>
          <List sx={{ width: 260, pt: 2, bgcolor: '#FFFFFF', height: '100%' }}>
            {menuItems.map((item) => (
              <ListItem key={item.label} disablePadding sx={{ px: 1, mb: 0.5 }}>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={isActive(item.path)}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: '#EEF2F6',
                      color: '#1E3A8A',
                      '& .MuiListItemIcon-root': { color: '#1E3A8A' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: '#64748B' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1 }} />
          <List sx={{ px: 1 }}>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2 }}>
                <ListItemIcon sx={{ minWidth: 40, color: '#64748B' }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
      </AppBar>

      {/* Main Content Area with 20-80 Grid persistent across all pages */}
      <Box component="main" sx={{ pt: `${NAV_HEIGHT + 32}px`, px: { xs: 2, md: 6 }, pb: 6 }}>
        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '20% 80%' }, gap: 4, alignItems: 'flex-start' }}>
          {/* 20% Column: Persistent Navigation Buttons */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              gap: 1,
              bgcolor: '#FFFFFF',
              p: 2,
              borderRadius: 3,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 10px rgba(0,0,0,0.02)',
            }}
          >
            {menuItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Button
                  key={item.label}
                  component={RouterLink}
                  to={item.path}
                  variant={active ? 'contained' : 'text'}
                  startIcon={item.icon}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.5,
                    px: 2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    bgcolor: active ? '#457B91' : 'transparent',
                    color: active ? '#FFFFFF' : '#475569',
                    boxShadow: 'none',
                    '& .MuiButton-startIcon': {
                      color: active ? '#FFFFFF' : '#64748B',
                    },
                    '&:hover': {
                      bgcolor: active ? '#457B91' : '#F8FAFC',
                      color: active ? '#FFFFFF' : '#1E293B',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          {/* 80% Column: Dynamic Sub-page Content */}
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              bgcolor: '#FFFFFF',
              p: { xs: 2.5, md: 4 },
              borderRadius: 3,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <Routes>
              <Route
                index
                element={<Overview users={users} properties={properties} reservations={reservations} />}
              />
              <Route path="users" element={<UserManagement />} />
              <Route path="hosts" element={<HostManagement />} />
              <Route path="properties" element={<PropertyManagement />} />
              <Route path="reservations" element={<ReservationMonitoring />} />
              <Route path="reviews" element={<ReviewModeration />} />
              <Route path="reports" element={<Report />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to={BASE} replace />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}