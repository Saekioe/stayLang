import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, InputAdornment, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { getAuth } from 'firebase/auth';
import {
  collection, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { describeCounts, planUserRemoval, runRemoval } from '../../dataqueries/AdminCleanup';
import {
  DeleteButton, PageHeader, Panel, StatusPill, TextAction, colors, tableSx,
} from './adminUi';

const initials = (u) =>
  `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || u.email?.[0]?.toUpperCase() || '?';

const roleOf = (u) => {
  if (u.role === 'admin') return 'admin';
  return u.isHost ? 'host' : 'guest';
};

const formatDate = (v) => {
  if (!v) return '-';
  const d = v.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePlan, setDeletePlan] = useState(null); // what the removal will do, or why it is blocked
  const [planError, setPlanError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const myId = getAuth().currentUser?.uid;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream users.'));
    return unsub;
  }, []);

  const counts = useMemo(() => ({
    all: users.length,
    guest: users.filter((u) => roleOf(u) === 'guest').length,
    host: users.filter((u) => roleOf(u) === 'host').length,
    suspended: users.filter((u) => u.disabled).length,
  }), [users]);

  const update = async (id, updates, message = 'Record updated successfully.') => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
      setSuccess(message);
    } catch (err) {
      console.error(err);
      setError(`Could not complete action: ${err.code || err.message}`);
    }
  };

  const openEdit = (u) => {
    setEditForm({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', phone: u.phone ?? '' });
    setEditError('');
    setEditTarget(u);
  };

  const saveEdit = async () => {
    const firstName = editForm.firstName.trim();
    const lastName = editForm.lastName.trim();
    const phone = editForm.phone.trim();
    if (!firstName) return setEditError('Enter a first name.');
    if (phone && phone.replace(/\D/g, '').length < 10) return setEditError('Enter a valid phone number.');
    setEditError('');
    setEditSaving(true);
    await update(editTarget.id, { firstName, lastName, phone }, 'User details updated.');
    setEditSaving(false);
    setEditTarget(null);
  };

  const openSuspend = (u) => {
    setReason('');
    setSuspendTarget(u);
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    await update(suspendTarget.id, {
      disabled: true,
      disabledReason: reason.trim() || 'No reason given',
      disabledAt: serverTimestamp(),
    }, 'Account suspended.');
    setSuspendTarget(null);
  };

  const handleReinstate = (u) =>
    update(u.id, { disabled: false, disabledReason: '', disabledAt: null }, 'Account reinstated.');

  // Work out everything the removal touches before asking the admin to confirm.
  const openDelete = (u) => {
    setDeleteTarget(u);
    setDeletePlan(null);
    setPlanError('');
    planUserRemoval(u)
      .then(setDeletePlan)
      .catch((err) => {
        console.error(err);
        setPlanError(`Could not check what this user owns: ${err.code || err.message}`);
      });
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeletePlan(null);
    setPlanError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !deletePlan || deletePlan.blockers.length) return;
    setDeleting(true);
    try {
      await runRemoval(deletePlan.refs);
      setSelected(null);
      setSuccess('User and their related records removed.');
    } catch (err) {
      console.error(err);
      setError(`Could not finish deleting: ${err.code || err.message}. Nothing is lost, you can run it again.`);
    } finally {
      setDeleting(false);
      closeDelete();
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'suspended' ? u.disabled : roleOf(u) === tab);
    const text = `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase();
    return matchesTab && text.includes(search.toLowerCase());
  });

  // Always read the newest data for the open dialog
  const current = selected ? users.find((u) => u.id === selected) : null;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <PageHeader
        title="User Management"
        subtitle="Manage guests and hosts, verify accounts, and suspend users who break the rules."
      />

      <Panel
        title="All users"
        subtitle="Review accounts and control access"
        footer={`Showing ${filteredUsers.length} of ${users.length} users`}
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
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          sx={{ px: 2, borderBottom: `1px solid ${colors.line}` }}
        >
          <Tab value="all" label={`All (${counts.all})`} />
          <Tab value="guest" label={`Guests (${counts.guest})`} />
          <Tab value="host" label={`Hosts (${counts.host})`} />
          <Tab value="suspended" label={`Suspended (${counts.suspended})`} />
        </Tabs>

        <TableContainer>
          <Table sx={{ ...tableSx, '& .MuiTableBody-root .MuiTableRow-root': { height: 63 } }}>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No users found.</TableCell></TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = roleOf(u) === 'admin';
                  const isSelf = u.id === myId;
                  const locked = isAdmin || isSelf; // do not let admins act on admins or themselves
                  return (
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
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography sx={{ fontSize: 14 }}>{u.firstName} {u.lastName}</Typography>
                              {u.verified && <VerifiedOutlinedIcon sx={{ fontSize: 16, color: colors.link }} />}
                            </Box>
                            <Typography sx={{ fontSize: 12, color: colors.muted }}>
                              {u.username ? `@${u.username}` : '-'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: `${colors.link} !important` }}>{u.email}</TableCell>
                      <TableCell>
                        <Chip size="small" label={roleOf(u)} sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          label={u.disabled ? 'Suspended' : 'Active'}
                          variant={u.disabled ? 'disabled' : 'active'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextAction onClick={() => setSelected(u.id)}>View</TextAction>
                          {!locked && (
                            <>
                              <TextAction onClick={() => (u.disabled ? handleReinstate(u) : openSuspend(u))}>
                                {u.disabled ? 'Reinstate' : 'Suspend'}
                              </TextAction>
                              <DeleteButton
                                label={`Delete ${u.firstName ?? 'user'}`}
                                onClick={() => openDelete(u)}
                              />
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>

      {/* View dialog */}
      <Dialog open={Boolean(current)} onClose={() => setSelected(null)} fullWidth maxWidth="xs">
        {current && (
          <>
            <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
              {current.firstName} {current.lastName}
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Detail label="Email" value={current.email} />
                <Detail label="Username" value={current.username} />
                <Detail label="Role" value={roleOf(current).charAt(0).toUpperCase() + roleOf(current).slice(1)} />
                <Detail label="Phone" value={current.phone} />
                <Detail label="Joined" value={formatDate(current.createdAt)} />
                <Detail label="Status" value={current.disabled ? 'Suspended' : 'Active'} />
                {current.disabled && <Detail label="Reason" value={current.disabledReason} />}
              </Box>
            </DialogContent>
            <DialogActions>
              {roleOf(current) !== 'admin' && current.id !== myId && (
                <Button onClick={() => openEdit(current)}>Edit details</Button>
              )}
              <Button
                onClick={() => update(
                  current.id,
                  { verified: !current.verified },
                  current.verified ? 'Verification removed.' : 'Account verified.'
                )}
              >
                {current.verified ? 'Remove verification' : 'Verify account'}
              </Button>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={Boolean(editTarget)} onClose={() => !editSaving && setEditTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
          Edit {editTarget?.firstName} {editTarget?.lastName}
        </DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="First name"
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              autoFocus
            />
            <TextField
              label="Last name"
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
            />
            <TextField
              label="Phone number"
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Typography sx={{ fontSize: 12, color: colors.muted }}>
              Email and username can't be changed here because they are used to sign in.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
          Suspend {suspendTarget?.firstName} {suspendTarget?.lastName}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: colors.muted, mb: 2 }}>
            This user will lose access to their account. You can reinstate them later.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Reason for suspension"
            placeholder="Example: Fake listing, repeated cancellations..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmSuspend}>
            Suspend
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && closeDelete()}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
          Delete {deleteTarget?.firstName} {deleteTarget?.lastName}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: colors.muted }}>
            This permanently removes the profile, username and host application. You cannot undo this.
            If you only want to stop their access, use Suspend instead.
          </Typography>

          {!deletePlan && !planError && (
            <Typography sx={{ fontSize: 13, color: colors.muted, mt: 2 }}>Checking what else this user owns…</Typography>
          )}
          {planError && <Alert severity="error" sx={{ mt: 2 }}>{planError}</Alert>}
          {deletePlan && deletePlan.blockers.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>{deletePlan.blockers.join(' ')}</Alert>
          )}
          {deletePlan && deletePlan.blockers.length === 0 && describeCounts(deletePlan.counts).length > 0 && (
            <Typography sx={{ fontSize: 14, mt: 2 }}>
              Also removed: {describeCounts(deletePlan.counts).join(', ')}. Past reservations stay in the records.
            </Typography>
          )}
          <Typography sx={{ fontSize: 12, color: colors.muted, mt: 2 }}>
            Their sign-in account stays, but they can no longer use it: signing in shows that the account no longer exists.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={deleting}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={deleting || !deletePlan || deletePlan.blockers.length > 0}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: colors.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: 14 }}>{value || '-'}</Typography>
    </Box>
  );
}