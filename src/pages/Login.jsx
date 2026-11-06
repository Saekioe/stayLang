import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Divider, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import PersonIcon from '@mui/icons-material/Person';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { useAuth, authMessage, resolveEmail, isAdminEmail, signInWithGoogle } from '../auth/Auth';
import { Field, AuthCard, GoogleButton } from '../components/Authui';

export default function Login() {
  const navigate = useNavigate();
  const { user, setProfile } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => sessionStorage.getItem('authNotice') || '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem('authNotice');
  }, []);

  if (user && !busy) {
    return <Navigate to={isAdminEmail(user.email) ? '/admin/dashboard' : '/'} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!identifier.trim() || !password) return setError('Enter your email or username and password.');
    setBusy(true);
    try {
      const email = await resolveEmail(identifier);
      if (!email) {
        setError(authMessage('auth/user-not-found'));
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);

        // The admin may not have a users doc, so skip the check for admin emails
        if (!isAdminEmail(email)) {
          const snap = await getDoc(doc(db, 'users', cred.user.uid));
          if (!snap.exists()) {
            await signOut(auth);
            setError('This account no longer exists.');
          } else if (snap.data().disabled) {
            await signOut(auth);
            const why = snap.data().disabledReason;
            setError(`Your account is suspended.${why ? ` Reason: ${why}` : ''}`);
          } else {
            setProfile(snap.data());
          }
        }
      }
    } catch (err) {
      setError(authMessage(err.code));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
    else if (result.profile) setProfile(result.profile);
    setBusy(false);
  };

  const handleForgot = async () => {
    setError('');
    setInfo('');
    if (!identifier.trim()) return setError('Enter your email or username first.');
    try {
      const email = await resolveEmail(identifier);
      if (email) await sendPasswordResetEmail(auth, email);
      setInfo('If an account exists, a password reset link has been sent to its email.');
    } catch (err) {
      setError(authMessage(err.code));
    }
  };

  return (
    <AuthCard title="Login">
      <Box component="form" onSubmit={handleLogin} noValidate>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 1.5 }}>{info}</Alert>}

        <Field
          label="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <Button size="small" onClick={handleForgot} sx={{ display: 'block', mx: 'auto', mb: 1.5, color: '#3F51B5' }}>
          Forgot Password?
        </Button>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disableElevation
          disabled={busy}
          startIcon={<LoginIcon />}
          sx={{ borderRadius: '8px', py: 1 }}
        >
          {busy ? 'Logging in…' : 'Login'}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Or</Typography>
      </Divider>

      <Box sx={{ display: 'grid', gap: 1 }}>
        <GoogleButton onClick={handleGoogle} disabled={busy} />
        <Button
          fullWidth
          startIcon={<PersonIcon />}
          onClick={() => navigate('/')}
          sx={{
            bgcolor: '#D9D9D9',
            color: 'text.primary',
            borderRadius: '8px',
            '&:hover': { bgcolor: '#CFCFCF' },
          }}
        >
          Continue as a guest
        </Button>
        <Button
          fullWidth
          component={RouterLink}
          to="/signup"
          startIcon={<PersonAddAltIcon />}
          sx={{
            bgcolor: '#D9D9D9',
            color: 'text.primary',
            borderRadius: '8px',
            '&:hover': { bgcolor: '#CFCFCF' },
          }}
        >
          Create an account
        </Button>
      </Box>
    </AuthCard>
  );
}