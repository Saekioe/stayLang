import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Box, Link, Typography } from '@mui/material';
import { db } from '../firebase/firebase';
import { isAdminEmail, useAuth } from '../auth/Auth';

// Watches settings/platform (readable by everyone) for the admin's maintenance switch.
function usePlatformStatus() {
  const [status, setStatus] = useState({ maintenance: false, supportEmail: '' });

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'platform'),
        (snap) => {
          const d = snap.exists() ? snap.data() : {};
          setStatus({ maintenance: Boolean(d.maintenance), supportEmail: String(d.supportEmail ?? '').trim() });
        },
        () => {}
      ),
    []
  );

  return status;
}

// While maintenance mode is on, everyone except the admin sees this page instead of the site.
// /login stays open so the admin can still sign in.
export default function MaintenanceGate({ children }) {
  const { user, loading } = useAuth();
  const { maintenance, supportEmail } = usePlatformStatus();
  const { pathname } = useLocation();

  if (!maintenance || pathname === '/login') return children;
  if (loading) return null; // wait to find out whether this is the admin
  if (isAdminEmail(user?.email)) return children;

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', px: 3 }}>
      <Box sx={{ maxWidth: 460 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5 }}>
          We'll be right back
        </Typography>
        <Typography sx={{ color: '#7A7070', mb: 2 }}>
          Pahinga is down for maintenance. Please check back soon. Your existing bookings are safe.
        </Typography>
        {supportEmail && (
          <Typography sx={{ mb: 2 }}>
            Need help? Contact <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>
          </Typography>
        )}
        <Link href="/login" underline="hover" sx={{ fontSize: 13, color: '#9a9090' }}>
          Admin sign in
        </Link>
      </Box>
    </Box>
  );
}
