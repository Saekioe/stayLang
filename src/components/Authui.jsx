import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Divider, IconButton, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// Gray filled input with its label above, like the Figma frames.
// `htmlInput` passes attributes to the native <input> (e.g. { max: '2026-10-17' }).
export function Field({ label, type = 'text', htmlInput, ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <Box sx={{ mb: 1.5, width: '100%' }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, color: '#000000' }}>
        {label}
      </Typography>
      <TextField
        fullWidth
        hiddenLabel
        size="small"
        variant="filled"
        type={isPassword && show ? 'text' : type}
        slotProps={{
          htmlInput: { 'aria-label': label, ...htmlInput },
          input: {
            disableUnderline: true,
            sx: {
              border: '1px solid #d9d9d9',
              bgcolor: '#d9d9d902',
              borderRadius: '8px',
              '&:hover, &.Mui-focused': { bgcolor: '#eeeeee' },
            },
            endAdornment: isPassword && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        {...props}
      />
    </Box>
  );
}

export function AuthCard({ title, subtitle, children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 480, p: 4, borderRadius: '16px' }}>
        <Typography
          component={RouterLink}
          to="/"
          sx={{ display: 'block', textAlign: 'center', fontWeight: 700, color: 'text.primary', textDecoration: 'none', color: '#575656' }}
        >
          StayLang
        </Typography>
        <Typography variant="h5" component="h1" sx={{ textAlign: 'center', fontWeight: 600, mt: 0.5, color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        {children}
      </Paper>
    </Box>
  );
}