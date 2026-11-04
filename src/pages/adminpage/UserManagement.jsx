import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import {
  DeleteButton, PageHeader, Panel, StatusPill, TextAction, colors, tableSx,
} from './adminUi';
 
const initials = (u) =>
  `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || u.email?.[0]?.toUpperCase() || '?';
 
export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
 
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream users.'));
    return unsub;
  }, []);
 
  const handleUpdateStatus = async (id, updates) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
      setSuccess('Record updated successfully.');
    } catch {
      setError('Could not complete administrative action.');
    }
  };
 
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record permanently?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setSuccess('Record removed successfully.');
    } catch {
      setError('Could not delete record.');
    }
  };
 
  const filteredUsers = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase().includes(search.toLowerCase())
  );
 
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
 
      <PageHeader title="User Management" subtitle="Manage platform accounts, review user details and control access." />
 
      <Panel
        title="All users"
        subtitle="Manage account access and status"
        footer={`Showing all ${filteredUsers.length} users`}
        action={
          <TextField
            size="small"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon sx={{ fontSize: 18, color: colors.muted }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: { xs: 180, sm: 265 },
              '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14, bgcolor: '#fff' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.line },
            }}
          />
        }
      >
        <TableContainer>
          <Table sx={{ ...tableSx, '& .MuiTableBody-root .MuiTableRow-root': { height: 63 } }}>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No users found.</TableCell></TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 32, height: 32, fontSize: 11, bgcolor: '#F5F6F8',
                            color: '#6B7280', border: `1px solid ${colors.line}`,
                          }}
                        >
                          {initials(u)}
                        </Avatar>
                        <Typography sx={{ fontSize: 14 }}>{u.firstName} {u.lastName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: `${colors.link} !important` }}>{u.email}</TableCell>
                    <TableCell>{u.username || '-'}</TableCell>
                    <TableCell>
                      <StatusPill label={u.disabled ? 'Disabled' : 'Active'} variant={u.disabled ? 'disabled' : 'active'} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TextAction onClick={() => handleUpdateStatus(u.id, { disabled: !u.disabled })}>
                          {u.disabled ? 'Enable' : 'Disable'}
                        </TextAction>
                        <DeleteButton label={`Delete ${u.firstName ?? 'user'}`} onClick={() => handleDelete(u.id)} />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </>
  );
}