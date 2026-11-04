import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, Badge, Divider,
  Drawer, List, ListItemButton, ListItemText, ListItemIcon, Menu, MenuItem,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EventNoteIcon from '@mui/icons-material/EventNote';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuIcon from '@mui/icons-material/Menu';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { useAuth } from '../auth/Auth';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNotifications } from '../dataqueries/Data';
import EditProfile from './EditProfile';
import logo from '../assets/logo.png';
import { useHostApplication } from '../dataqueries/Host';


const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Deals', to: '/#about' },
  { label: 'Find Places', to: '/places' },
];



export default function NavigationBar() {
  const { user, profile, loading, logout } = useAuth();
  const { unread } = useNotifications(user?.uid);
  const [active, setActive] = useState('Home');
  const { pathname } = useLocation();
  const current = pathname === '/places' ? 'Find Places' : active;
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const closeMenu = () => setAnchorEl(null);
  // near the top of the component, after the other hooks

  const { status: hostStatus } = useHostApplication(user?.uid);
  const hostLabel = {
  none: 'Apply as a Host',
  pending: 'Application pending',
  rejected: 'Reapply as a Host',
  approved: 'My Property',
}[hostStatus] ?? 'Apply as a Host';

  const [editOpen, setEditOpen] = useState(false);

  const displayName =
    profile?.firstName || user?.displayName || user?.email?.split('@')[0] || '';
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : displayName;

  return (
    <>
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
            <Box
              component="img"
              src={logo}
              alt="StayLang Logo"
              sx={{ height: 35, ml: 1.25 }}
            />
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              sx={{ fontWeight: 'bold', color: '#0f4a5f', textDecoration: 'none', fontSize: '1.1rem', ml: 1 }}
            >
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
                    {!loading && (
                      <Button
                        component={RouterLink}
                        to="/my-property"
                        variant="outlined"
                        sx={{ borderRadius: '20px', fontSize: '0.8rem', px: 2, py: 0.5, mr: 1, borderColor: '#457B91', color: '#feffff', bgcolor: '#457B91', '&:hover': { bgcolor: '#F4F4F4', color: '#0F4A5F' } }}
                      >
                        {user ? hostLabel : 'Apply as a Host'}
                      </Button>
                    )}
                    {loading ? null : user ? (
                      <>
                  <IconButton
                    component={RouterLink}
                    to="/notifications"
                    color="inherit"
                    aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                  >
                      <Badge badgeContent={unread} color="error" max={99}>
                        <NotificationsIcon />
                      </Badge>
                  </IconButton>
                <Button
                  color="inherit"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen ? 'true' : undefined}
                  aria-controls={menuOpen ? 'account-menu' : undefined}
                  aria-label={unread ? `Account menu, ${unread} unread messages` : 'Account menu'}
                  endIcon={<KeyboardArrowDownIcon />}
                  sx={{
                    borderRadius: 99,
                    pl: 0.75,
                    pr: 1.5,
                    py: 0.5,
                    border: '1px solid #d6d6d6',
                    '&:hover': { bgcolor: '#F4F4F4' },
                  }}
                >  
                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.8rem' }}>
                      
                    </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600, ml: 1, display: { xs: 'none', sm: 'block' } }}>
                    {displayName}
                  </Typography>
                </Button>

                <Menu
                  id="account-menu"
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={closeMenu}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{ paper: { sx: { mt: 1, minWidth: 240, borderRadius: '12px' } } }}
                >
                  <Box sx={{ px: 2, py: 1.25, textAlign: 'left' }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>{fullName}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>{user.email}</Typography>
                  </Box>
                  <Divider />
                  <MenuItem component={RouterLink} to="/my-bookings" onClick={closeMenu}>
                    <ListItemIcon><EventNoteIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>My bookings</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { closeMenu(); setEditOpen(true); }}>
                    <ListItemIcon><ManageAccountsIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit profile</ListItemText>
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      closeMenu();
                      logout();
                    }}
                  >
                    <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Logout</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button color="inherit" size="small" component={RouterLink} to="/login" >
                  Login
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  component={RouterLink}
                  to="/signup"
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    bgcolor: '#F8F5C5',
                    color: 'text.primary',
                    borderRadius: 99,
                    px: 2,
                    '&:hover': { bgcolor: '#f9ee5e' },
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

      {/* External Edit Profile Modal Component */}
      <EditProfile open={editOpen} onClose={() => setEditOpen(false)} user={user} profile={profile} />
    </>
  );
}