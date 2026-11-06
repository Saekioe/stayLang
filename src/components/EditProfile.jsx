import { useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, IconButton, InputAdornment, Divider,
} from '@mui/material';
import { Visibility, VisibilityOff, LockReset } from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { db, auth } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';

// --- Change Password Dialog Component ---
function ChangePasswordDialog({ open, onClose, user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleResetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Re-authenticate user with their recent/current password for security
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update to the new password
      await updatePassword(user, newPassword);

      setSuccessMsg('Password updated successfully!');
      setTimeout(() => {
        handleResetForm();
      }, 1200);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Incorrect current password.');
      } else {
        setErrorMsg('Failed to update password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleResetForm} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: '1px', p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockReset color="primary" /> Change Password
      </DialogTitle>
      <DialogContent dividers>
        {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: '1px' }}>{errorMsg}</Alert>}
        {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: '1px' }}>{successMsg}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <TextField
            label="Current Password"
            type={showCurrent ? 'text' : 'password'}
            size="small"
            fullWidth
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowCurrent(!showCurrent)} edge="end" size="small">
                    {showCurrent ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="New Password"
            type={showNew ? 'text' : 'password'}
            size="small"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNew(!showNew)} edge="end" size="small">
                    {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Confirm New Password"
            type={showConfirm ? 'text' : 'password'}
            size="small"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" size="small">
                    {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, px: 3 }}>
        <Button onClick={handleResetForm} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleChangePassword} variant="contained" disabled={saving} sx={{ borderRadius: '1px', textTransform: 'none', px: 3 }}>
          {saving ? 'Updating...' : 'Update Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Main Profile Form Component ---
function ProfileForm({ onClose, user, profile }) {
  const { setProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  // Host information is only for approved hosts (the admin sets isHost)
  const isHost = Boolean(profile?.isHost);
  const [businessName, setBusinessName] = useState(profile?.businessName || '');
  const [hostBio, setHostBio] = useState(profile?.hostBio || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Enter your first and last name.');
      return;
    }
    if (isHost && hostBio.trim().length > 500) {
      setErrorMsg('Keep the host bio to 500 characters or fewer.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const changes = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      ...(isHost ? { businessName: businessName.trim(), hostBio: hostBio.trim() } : {}),
    };
    try {
      await setDoc(doc(db, 'users', user.uid), changes, { merge: true });
      setProfile((prev) => ({ ...(prev ?? {}), ...changes }));
      setSuccessMsg('Profile updated successfully!');
      setTimeout(onClose, 1200);
    } catch {
      setErrorMsg('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogTitle sx={{ fontWeight: 700, color: 'text.primary' }}>Edit Account Information</DialogTitle>
      <DialogContent dividers>
        {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: '1px' }}>{errorMsg}</Alert>}
        {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: '1px' }}>{successMsg}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="First Name"
            size="small"
            fullWidth
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <TextField
            label="Last Name"
            size="small"
            fullWidth
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <TextField label="Email" size="small" fullWidth disabled value={user?.email || ''} />
          <TextField
            label="Phone"
            size="small"
            fullWidth
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          {isHost && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box>
                <Box sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Host information</Box>
                <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  Shown on your listings. New listings start with this bio.
                </Box>
              </Box>
              <TextField
                label="Business or host name (optional)"
                size="small"
                fullWidth
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                helperText="Leave blank to show your first name and last initial."
              />
              <TextField
                label="About the host"
                size="small"
                fullWidth
                multiline
                minRows={3}
                value={hostBio}
                onChange={(e) => setHostBio(e.target.value)}
                helperText={`${hostBio.trim().length}/500`}
              />
            </>
          )}

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Box sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Password</Box>
              <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Protect your account with a secure password</Box>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPasswordDialogOpen(true)}
              sx={{ borderRadius: '1px', textTransform: 'none' }}
            >
              Change Password
            </Button>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSaveProfile} variant="contained" disabled={saving} sx={{ borderRadius: '1px', textTransform: 'none', px: 3 }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>

      {/* Sub-dialog for changing password */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        user={user}
      />
    </>
  );
}

export default function EditProfile({ open, onClose, user, profile }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: '1px' } }}>
      <ProfileForm onClose={onClose} user={user} profile={profile} />
    </Dialog>
  );
}