import { useState } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';

// The form lives inside the Dialog, so MUI mounts it fresh every time the dialog
// opens. That makes the fields start from the profile that is loaded right now,
// instead of from whatever the profile was when the navbar first rendered.
function ProfileForm({ onClose, user, profile }) {
  const { setProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Enter your first and last name.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const changes = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
    };
    try {
      // merge: true keeps username, birthday, email, etc. untouched.
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
      <DialogTitle sx={{ fontWeight: 700, color: 'black' }}>Edit Account Information</DialogTitle>
      <DialogContent dividers>
        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
        {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

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
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSaveProfile} variant="contained" disabled={saving} sx={{ borderRadius: '8px' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </>
  );
}

export default function EditProfile({ open, onClose, user, profile }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: '12px' } }}>
      <ProfileForm onClose={onClose} user={user} profile={profile} />
    </Dialog>
  );
}