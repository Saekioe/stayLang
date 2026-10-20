import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, Badge,
  Drawer, List, ListItemButton, ListItemText,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import MenuIcon from '@mui/icons-material/Menu';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import { useAuth } from '../Auth';
import { useNotifications } from '../Data';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Deals', to: '/#about' },
  { label: 'Find Places', to: '/places' },
  { label: 'My Property', to: '/my-property' },
];

export default function NavigationBar() {
  const { user, profile, loading, logout } = useAuth();
  const { unread } = useNotifications(user?.uid);
  const [active, setActive] = useState('Home');
  const { pathname } = useLocation();
  const current =
    pathname === '/places' ? 'Find Places' : pathname === '/my-property' ? 'My Property' : active;
  const [open, setOpen] = useState(false);

  const displayName =
    profile?.firstName || user?.displayName || user?.email?.split('@')[0] || '';

  return (
    <AppBar id="home" position="fixed" elevation={0} sx={{ backgroundColor: '#ffffff', color: '#42403d' }}>
      <Toolbar sx={{ px: { xs: 1, md: 6 }, minHeight: 72, borderBottom: '0.1px solid #d6d6d6' }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <IconButton
            color="inherit"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            sx={{ display: { md: 'none' }, mr: 0.5 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: '#0f4a5f' }}>
            StayLang
          </Typography>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, textShadow: '0 1px 10px rgba(0,0,0,0.1)' }}>
          {navLinks.map(({ label, to }) => (
            <Button
              key={label}
              component={RouterLink}
              to={to}
              color="inherit"
              size="small"
              onClick={() => setActive(label)}
              sx={{
                fontWeight: 600,
                textDecoration: current === label ? 'underline' : 'none',
                textUnderlineOffset: 4,
              }}
            >
              {label}
            </Button>
          ))}
        </Box>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
          {loading ? null : user ? (
            <>
              <IconButton
                component={RouterLink}
                to="/inbox"
                color="inherit"
                aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}
              >
                <Badge badgeContent={unread} color="primary" max={9}>
                  <InboxIcon />
                </Badge>
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.8rem' }}>
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                  {displayName}
                </Typography>
              </Box>
              <Button color="inherit" size="small" startIcon={<LogoutIcon />} onClick={logout} sx={{backgroundColor: '#D9D9D9', borderRadius: 99, px: 2, '&:hover': { bgcolor: '#CFCFCF' }}}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" size="small" component={RouterLink} to="/login" startIcon={<LoginIcon />}>
                Login
              </Button>
              <Button
                variant="contained"
                disableElevation
                size="small"
                component={RouterLink}
                to="/signup"
                startIcon={<PersonAddAltIcon />}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  bgcolor: '#D9D9D9',
                  color: 'text.primary',
                  borderRadius: 99,
                  px: 2,
                  '&:hover': { bgcolor: '#CFCFCF' },
                }}
              >
                Sign up
              </Button>
            </>
          )}
        </Box>
      </Toolbar>

      <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
        <List sx={{ width: 220 }}>
          {navLinks.map(({ label, to }) => (
            <ListItemButton
              key={label}
              component={RouterLink}
              to={to}
              onClick={() => {
                setActive(label);
                setOpen(false);
              }}
            >
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
    </AppBar>
  );
}