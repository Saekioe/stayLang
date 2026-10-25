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
    <>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Platform Overview</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="body2" color="text.secondary">Total Accounts</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>{users.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="body2" color="text.secondary">Active Hosts</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>{hosts.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="body2" color="text.secondary">Listings</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>{properties.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="body2" color="text.secondary">Total Volume</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#2e7d32' }}>${totalEarnings.toLocaleString()}</Typography>
        </Paper>
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Manage</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        {menuItems.filter((item) => item.path !== BASE).map((item) => (
          <Button
            key={item.label}
            component={RouterLink}
            to={item.path}
            variant="outlined"
            startIcon={item.icon}
            sx={{
              justifyContent: 'flex-start',
              py: 1.75,
              px: 2.5,
              borderRadius: 3,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#ffffff',
              color: '#0f4a5f',
              borderColor: '#e2e8f0',
              '&:hover': { bgcolor: '#f1f5f9', borderColor: '#0f4a5f' },
            }}
          >
            {item.label}
          </Button>
        ))}
      </Box>
    </>
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
  if (loading) return <Box sx={{ py: 12, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Top Navigation Bar */}
      <AppBar position="fixed" elevation={0} sx={{ backgroundColor: '#ffffff', color: '#42403d' }}>
        <Toolbar sx={{ px: { xs: 1, md: 6 }, minHeight: NAV_HEIGHT, borderBottom: '0.1px solid #d6d6d6' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <IconButton
              color="inherit"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { lg: 'none' }, mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: '#0f4a5f', lineHeight: 1.2 }}>
                StayLang
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1 }}>
                Admin Control Panel
              </Typography>
            </Box>
          </Box>

          {/* Nav links (desktop) */}
          <Box
            sx={{
              flex: 1,
              display: { xs: 'none', lg: 'flex' },
              justifyContent: 'center',
              gap: 0.5,
              px: 2,
              overflowX: 'auto',
            }}
          >
            {menuItems.map((item) => (
              <Button
                key={item.label}
                component={RouterLink}
                to={item.path}
                color="inherit"
                size="small"
                sx={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  textDecoration: isActive(item.path) ? 'underline' : 'none',
                  textUnderlineOffset: 4,
                  color: isActive(item.path) ? '#0f4a5f' : 'inherit',
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ flex: 1, display: { lg: 'none' } }} />

          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{
              borderRadius: 99,
              px: 2,
              py: 0.5,
              fontWeight: 600,
              flexShrink: 0,
              border: '1px solid #d6d6d6',
              '&:hover': { bgcolor: '#F4F4F4' },
            }}
          >
            Logout
          </Button>
        </Toolbar>

        {/* Mobile drawer */}
        <Drawer anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)}>
          <List sx={{ width: 260 }}>
            {menuItems.map((item) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={isActive(item.path)}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
      </AppBar>

      {/* Main Content Area with routes */}
      <Box component="main" sx={{ pt: `${NAV_HEIGHT + 32}px`, px: { xs: 2, md: 6 }, pb: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

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
  );
}