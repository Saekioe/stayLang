import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { createUserWithEmailAndPassword, deleteUser, updateProfile } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth, authMessage } from '../Auth';
import { Field, AuthCard } from '../components/Authui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const today = new Date().toISOString().split('T')[0];

export default function Signup() {
  const navigate = useNavigate();
  const { setProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', confirm: '',
    firstName: '', lastName: '', username: '', birthday: '', phone: '',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Step 1: credentials
  const handleNext = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(form.email.trim())) return setError('Enter a valid email address.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setError('');
    setStep(2);
  };

  // Step 2: profile, then create everything
  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim().toLowerCase();

    if (!form.firstName.trim() || !form.lastName.trim()) return setError('Enter your first and last name.');
    if (!USERNAME_RE.test(username)) return setError('Username must be 3–20 characters: letters, numbers, "_" or ".".');
    if (!form.birthday) return setError('Enter your birthday.');

    setError('');
    setBusy(true);

    try {
      // Quick pre-check so we don't create an account for a taken username.
      if ((await getDoc(doc(db, 'usernames', username))).exists()) {
        setBusy(false);
        return setError('That username is already taken.');
      }

      // Firebase Auth enforces unique emails and throws if it's already used.
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, email, form.password);
      } catch (err) {
        setBusy(false);
        if (err.code === 'auth/email-already-in-use' || err.code === 'auth/invalid-email') setStep(1);
        return setError(authMessage(err.code));
      }

      const profile = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username,
        birthday: form.birthday,
        phone: form.phone.trim(),
        email,
      };

      try {
        // Transaction guards against two people claiming a username at once.
        await runTransaction(db, async (tx) => {
          const nameRef = doc(db, 'usernames', username);
          if ((await tx.get(nameRef)).exists()) throw new Error('username-taken');
          tx.set(nameRef, { uid: cred.user.uid, email });
          tx.set(doc(db, 'users', cred.user.uid), { ...profile, createdAt: serverTimestamp() });
        });
      } catch (err) {
        await deleteUser(cred.user).catch(() => {});
        setBusy(false);
        return setError(
          err.message === 'username-taken'
            ? 'That username is already taken.'
            : 'Could not save your profile. Please try again.'
        );
      }

      await updateProfile(cred.user, { displayName: profile.firstName }).catch(() => {});
      setProfile(profile);
      navigate('/');
    } catch (err) {
      setBusy(false);
      setError(authMessage(err.code));
    }
  };

  return (
    <AuthCard title="Signup" subtitle={`Step ${step} of 2`}>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      {step === 1 ? (
        <Box component="form" onSubmit={handleNext} noValidate>
          <Field label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" autoFocus />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          <Field label="Confirm Password" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          <Button
            type="submit"
            variant="contained"
            disableElevation
            endIcon={<ArrowForwardIcon />}
            sx={{ display: 'flex', mx: 'auto', mt: 2, borderRadius: '8px', px: 4 }}
          >
            Next
          </Button>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Field label="First name" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" autoFocus />
            <Field label="Last name" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
          </Box>
          <Field label="Username" value={form.username} onChange={set('username')} autoComplete="username" />
          <Field label="Birthday" type="date" value={form.birthday} onChange={set('birthday')} htmlInput={{ max: today }} autoComplete="bday" />
          <Field label="Phone number (optional)" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => { setError(''); setStep(1); }} disabled={busy} color="inherit">
              Back
            </Button>
            <Button type="submit" variant="contained" disableElevation disabled={busy} sx={{ borderRadius: '8px', px: 3 }}>
              {busy ? 'Creating…' : 'Create account'}
            </Button>
          </Box>
        </Box>
      )}

      <Typography variant="body2" sx={{ textAlign: 'center', mt: 3 }}>
        Already have an account?{' '}
        <Link component={RouterLink} to="/login" underline="hover">Login</Link>
      </Typography>
    </AuthCard>
  );
}