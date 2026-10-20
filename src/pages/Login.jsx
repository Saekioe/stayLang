import { useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Divider, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth, authMessage, resolveEmail } from '../Auth';
import { Field, AuthCard } from '../components/Authui';

const grayBtn = {
  bgcolor: '#D9D9D9',
  color: 'text.primary',
  borderRadius: '8px',
  '&:hover': { bgcolor: '#CFCFCF' },
};

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

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
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      }
    } catch (err) {
      setError(authMessage(err.code));
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setInfo('');
    if (!identifier.trim()) return setError('Enter your email or username first.');
    try {
      const email = await resolveEmail(identifier);
      if (email) await sendPasswordResetEmail(auth, email);
      // Same message either way so this can't be used to probe for accounts.
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
        <Button fullWidth startIcon={<PersonOutlineIcon />} onClick={() => navigate('/')} sx={grayBtn}>
          Continue as a guest
        </Button>
        <Button fullWidth component={RouterLink} to="/signup" startIcon={<PersonAddAltIcon />} sx={grayBtn}>
          Create an account
        </Button>
      </Box>
    </AuthCard>
  );
}