import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
  IconButton, Divider, Rating
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CategoryIcon from '@mui/icons-material/Category';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../../Auth';

const ADMIN_EMAILS = ['admin@staylang.com'];
const SIDEBAR_WIDTH = 260;

const menuItems = [
  { label: 'Overview', icon: <DashboardIcon /> },
  { label: 'User Management', icon: <PeopleIcon /> },
  { label: 'Host Management', icon: <SupervisorAccountIcon /> },
  { label: 'Property Moderation', icon: <HomeWorkIcon /> },
  { label: 'Reservation Monitoring', icon: <BookOnlineIcon /> },
  { label: 'Review Moderation', icon: <RateReviewIcon /> },
  { label: 'Reports & Analytics', icon: <AssessmentIcon /> },
  { label: 'Categories & Settings', icon: <CategoryIcon /> },
];

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  // Firestore collections state
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [categories, setCategories] = useState(['Apartment', 'Villa', 'Cabin', 'Loft', 'Beachhouse']);
  const [newCat, setNewCat] = useState('');

  // UI state
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

    const unsubRev = onSnapshot(collection(db, 'reviews'), (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});

    return () => {
      unsubUsers();
      unsubProps();
      unsubRes();
      unsubRev();
    };
  }, [user]);

  // Handle Logout
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

  // Common Action Handlers
  const handleUpdateStatus = async (col, id, updates) => {
    try {
      await updateDoc(doc(db, col, id), updates);
      setSuccess('Record updated successfully.');
    } catch {
      setError('Could not complete administrative action.');
    }
  };

  const handleDelete = async (col, id) => {
    if (!window.confirm('Are you sure you want to delete this record permanently?')) return;
    try {
      await deleteDoc(doc(db, col, id));
      setSuccess('Record removed successfully.');
    } catch {
      setError('Could not delete record.');
    }
  };

  const handleAddCategory = () => {
    if (!newCat.trim()) return;
    setCategories([...categories, newCat.trim()]);
    setNewCat('');
  };

  // Filtered dataset helpers
  const hosts = users.filter((u) => u.isHost || properties.some((p) => p.ownerId === u.id));
  const filteredUsers = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalEarnings = reservations
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.total || 0), 0);

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#1a2e26',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justify: 'space-between',
          },
        }}
      >
        <Box>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#68d391' }}>StayLang</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Admin Control Panel</Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <List sx={{ pt: 2 }}>
            {menuItems.map((item, index) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  selected={activeTab === index}
                  onClick={() => { setActiveTab(index); setSearch(''); }}
                  sx={{
                    mx: 1,
                    borderRadius: '8px',
                    mb: 0.5,
                    '&.Mui-selected': { bgcolor: '#27473a', color: '#68d391' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <ListItemIcon sx={{ color: activeTab === index ? '#68d391' : 'rgba(255,255,255,0.7)', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: activeTab === index ? 700 : 500 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Sidebar Footer with Logout Button */}
        <Box sx={{ p: 2 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{
              color: '#ff8a80',
              borderColor: 'rgba(255, 138, 128, 0.4)',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#ff8a80',
                bgcolor: 'rgba(255, 138, 128, 0.08)',
              },
            }}
          >
            Logout
          </Button>
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, p: 4, width: `calc(100% - ${SIDEBAR_WIDTH}px)` }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* 0. OVERVIEW / ANALYTICS */}
        {activeTab === 0 && (
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
          </>
        )}

        {/* 1. USER MANAGEMENT */}
        {activeTab === 1 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>User Management</Typography>
              <TextField
                size="small"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
            </Box>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#edf2f7' }}>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No users found.</TableCell></TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.username || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={u.disabled ? 'Disabled' : 'Active'} color={u.disabled ? 'error' : 'success'} />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => handleUpdateStatus('users', u.id, { disabled: !u.disabled })}>
                            {u.disabled ? 'Enable' : 'Disable'}
                          </Button>
                          <IconButton color="error" size="small" onClick={() => handleDelete('users', u.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* 2. HOST MANAGEMENT */}
        {activeTab === 2 && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Host Approvals & Status</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#edf2f7' }}>
                  <TableRow>
                    <TableCell>Host</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Properties Count</TableCell>
                    <TableCell>Approval Status</TableCell>
                    <TableCell align="right">Moderation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hosts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No hosts found.</TableCell></TableRow>
                  ) : (
                    hosts.map((h) => {
                      const count = properties.filter((p) => p.ownerId === h.id).length;
                      return (
                        <TableRow key={h.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{h.firstName} {h.lastName}</TableCell>
                          <TableCell>{h.email}</TableCell>
                          <TableCell>{count} listings</TableCell>
                          <TableCell>
                            <Chip size="small" label={h.hostApproved ? 'Approved' : 'Pending Review'} color={h.hostApproved ? 'success' : 'warning'} />
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" color="success" onClick={() => handleUpdateStatus('users', h.id, { hostApproved: true })}>Approve</Button>
                            <Button size="small" color="error" onClick={() => handleUpdateStatus('users', h.id, { hostApproved: false })}>Reject</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* 3. PROPERTY MODERATION */}
        {activeTab === 3 && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Property Moderation</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#edf2f7' }}>
                  <TableRow>
                    <TableCell>Property</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Nightly Rate</TableCell>
                    <TableCell>Visibility</TableCell>
                    <TableCell align="right">Controls</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {properties.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No properties found.</TableCell></TableRow>
                  ) : (
                    properties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{p.title}</TableCell>
                        <TableCell>{p.city}</TableCell>
                        <TableCell>${p.pricePerNight}</TableCell>
                        <TableCell>
                          <Chip size="small" label={p.hidden ? 'Hidden' : 'Visible'} color={p.hidden ? 'default' : 'primary'} />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => handleUpdateStatus('properties', p.id, { hidden: !p.hidden })}>
                            {p.hidden ? 'Publish' : 'Hide'}
                          </Button>
                          <IconButton color="error" size="small" onClick={() => handleDelete('properties', p.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* 4. RESERVATION MONITORING */}
        {activeTab === 4 && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Platform Reservations</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#edf2f7' }}>
                  <TableRow>
                    <TableCell>Guest</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Dates</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reservations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No reservations found.</TableCell></TableRow>
                  ) : (
                    reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{r.guestName}</TableCell>
                        <TableCell>{r.propertyTitle}</TableCell>
                        <TableCell>{r.checkIn} to {r.checkOut}</TableCell>
                        <TableCell>${r.total}</TableCell>
                        <TableCell>
                          <Chip size="small" label={r.status} color={r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : 'default'} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* 5. REVIEW MODERATION */}
        {activeTab === 5 && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Review Moderation</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#edf2f7' }}>
                  <TableRow>
                    <TableCell>Author</TableCell>
                    <TableCell>Rating</TableCell>
                    <TableCell>Comment</TableCell>
                    <TableCell align="right">Moderate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reviews.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>No reviews flagged or submitted.</TableCell></TableRow>
                  ) : (
                    reviews.map((rev) => (
                      <TableRow key={rev.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{rev.userName || 'Anonymous'}</TableCell>
                        <TableCell><Rating value={rev.rating || 5} readOnly size="small" /></TableCell>
                        <TableCell>{rev.comment}</TableCell>
                        <TableCell align="right">
                          <IconButton color="error" size="small" onClick={() => handleDelete('reviews', rev.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* 6. REPORTS & ANALYTICS */}
        {activeTab === 6 && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Reports & Analytics</Typography>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Booking Volume Summary</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Total confirmed platform revenue stands at ${totalEarnings.toLocaleString()}.</Typography>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Confirmed Stays</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{reservations.filter((r) => r.status === 'confirmed').length}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Cancelled/Declined</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{reservations.filter((r) => r.status === 'declined').length}</Typography>
                </Box>
              </Box>
            </Paper>
          </>
        )}

        {/* 7. CATEGORIES & SETTINGS */}
        {activeTab === 7 && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Categories & Platform Settings</Typography>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Manage Property Categories</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField size="small" fullWidth placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
                <Button variant="contained" onClick={handleAddCategory}>Add</Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categories.map((c) => (
                  <Chip key={c} label={c} onDelete={() => setCategories(categories.filter((item) => item !== c))} />
                ))}
              </Box>
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}