import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useAuth } from '../auth/Auth';
import { compressImage, submitHostApplication } from '../dataqueries/Host';
import { usePropertyTypes } from '../dataqueries/Data';

const ID_TYPES = ['Passport', "Driver's license", 'PhilSys National ID', 'UMID', 'Postal ID', "Voter's ID"];
const ROLES = [
  'I own the property',
  "I rent it and have the owner's permission",
  'I manage it for the owner',
];
const MAX_CHARS = 850000; // two photos must stay well under Firestore's 1 MB document limit

const cardSx = {
    width: { xs: '100%', md: '100%' },
  bgcolor: '#fff',
  border: '1px solid #E6E3E3',
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(63,54,54,.06)',
  p: { xs: 2.5, md: 4 },
  textAlign: 'left',
};

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#FBFAFA' } };

function Field({ label, ...props }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>{label}</Typography>
      <TextField
        required
        fullWidth
        size="small"
        slotProps={{ htmlInput: { 'aria-label': label } }}
        sx={fieldSx}
        {...props}
      />
    </Box>
  );
}

function UploadField({ label, hint, value, onPick }) {
  const [err, setErr] = useState('');

  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('Choose an image file such as JPG or PNG.');
    setErr('');
    try {
      onPick(await compressImage(file));
    } catch (x) {
      setErr(x.message);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>{label}</Typography>
      <Box
        component="label"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, cursor: 'pointer',
          border: '2px dashed #B9D0D9', bgcolor: '#E8F1F4', borderRadius: '12px',
          '&:hover': { bgcolor: '#DCEAEF' },
          '&:focus-within': { outline: '2px solid #457B91', outlineOffset: 2 },
        }}
      >
        <CloudUploadIcon sx={{ color: '#457B91', }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {value ? 'Replace photo' : 'Click to upload'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#7A7070' }}>{hint}</Typography>
        </Box>
        <input type="file" accept="image/*" hidden onChange={handle} />
      </Box>
      {value && (
        <Box
          component="img"
          src={value}
          alt={label}
          sx={{ mt: 1, maxWidth: '100%', maxHeight: 160, borderRadius: '10px', border: '1px solid #E6E3E3' }}
        />
      )}
      {err && <Typography variant="caption" color="error">{err}</Typography>}
    </Box>
  );
}

function validate(f, agreed) {
  if (!f.fullName.trim()) return 'Enter your full legal name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Enter a valid email.';
  if (f.phone.replace(/\D/g, '').length < 10) return 'Enter a valid mobile number.';
  if (!f.address.trim()) return 'Enter your home address.';
  if (!f.idType) return 'Choose a government ID type.';
  if (!f.idPhoto) return 'Upload a clear photo of your ID.';
  if (!f.role) return 'Tell us your relationship to the property.';
  if (!f.proofPhoto) return "Upload proof of ownership or the owner's permission.";
  if (!f.propertyCity.trim()) return 'Enter the city of the property you plan to list.';
  if (!f.propertyType) return 'Choose the type of property.';
  if (f.about.trim().length < 30) return 'Tell us about yourself and your hosting plans (at least 30 characters).';
  if (!agreed) return 'Please accept the host terms to continue.';
  if (f.idPhoto.length + f.proofPhoto.length > MAX_CHARS) return 'The photos are too large together. Use smaller photos.';
  return '';
}

export default function HostApplication({ application }) {
  const { user, profile } = useAuth();
  const propertyTypes = usePropertyTypes();
  const status = application?.status;

  const [form, setForm] = useState(() => ({
    fullName: application?.fullName ?? (profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.displayName || ''),
    email: application?.email ?? user?.email ?? '',
    phone: application?.phone ?? profile?.phone ?? '',
    address: application?.address ?? '',
    idType: application?.idType ?? '',
    idPhoto: application?.idPhoto ?? '',
    role: application?.role ?? '',
    proofPhoto: application?.proofPhoto ?? '',
    propertyCity: application?.propertyCity ?? '',
    propertyType: application?.propertyType ?? '',
    about: application?.about ?? '',
  }));
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    const message = validate(form, agreed);
    if (message) return setError(message);
    setError('');
    setBusy(true);
    try {
      await submitHostApplication(user.uid, {
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        propertyCity: form.propertyCity.trim(),
        about: form.about.trim(),
      });
    } catch {
      setError('Could not send your application. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'pending') {
    return (
      <Box sx={{ ...cardSx, textAlign: 'center', py: 7 }}>
        <Typography sx={{ color: '#7A7070', fontWeight: 600 }}>StayLang Host</Typography>
        <Typography component="h1" sx={{ fontSize: '2rem', fontWeight: 600, mt: 0.5, mb: 1, color: '#0F4A5F' }}>
          Application under review
        </Typography>
        <Typography sx={{ color: '#7A7070', maxWidth: 460, mx: 'auto' }}>
          Thanks, {application.fullName}. Our team is checking your details. Once you are approved,
          you can create and publish your listing here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={cardSx}>
      <Typography sx={{ color: '#7A7070', fontWeight: 600, fontSize: '0.9rem', ml: '5px' }}>StayLang Host</Typography>
      <Typography component="h1" sx={{ fontSize: { xs: '2rem', md: '2.2rem' }, fontWeight: 600, lineHeight: 1.1, mt: 0.5, color: '#0F4A5F',  }}>
        Apply to become a host
      </Typography>
      <Typography sx={{ color: '#7A7070', mt: 1, mb: 3 }}>
        Tell us about you and your place. After an admin approves your application, you can publish your listing.
      </Typography>
      <Box sx={{ borderTop: '0.5px solid #9b9b9b', mb: 4}}></Box>

      {status === 'rejected' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your last application was not approved.
          {application.reviewNote ? ` Reason: ${application.reviewNote}` : ''} You can fix the details and apply again.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 4 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, color: '#0F4A5F', fontSize: '0.85rem', mb: 1.5 }}>About you</Typography>
          <Field label="Full legal name" value={form.fullName} onChange={set('fullName')} />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Mobile number" type="tel" value={form.phone} onChange={set('phone')} />
          <Field label="Home address" multiline minRows={2} value={form.address} onChange={set('address')} />
          <Field label="Government ID type" select value={form.idType} onChange={set('idType')}>
            {ID_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Field>
          <UploadField
            label="Photo of your ID"
            hint="Clear photo, all four corners visible"
            value={form.idPhoto}
            onPick={(v) => setForm((f) => ({ ...f, idPhoto: v }))}
          />
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, color: '#7A7070', fontSize: '0.85rem', mb: 1.5 }}>Your property</Typography>
          <Field label="Your relationship to the property" select value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Field>
          <UploadField
            label="Proof of ownership or permission"
            hint="Title, tax declaration, lease, or the owner's authorization letter"
            value={form.proofPhoto}
            onPick={(v) => setForm((f) => ({ ...f, proofPhoto: v }))}
          />
          <Field label="City of the property" value={form.propertyCity} onChange={set('propertyCity')} />
          <Field label="Property type" select value={form.propertyType} onChange={set('propertyType')}>
            {(form.propertyType && !propertyTypes.includes(form.propertyType)
              ? [form.propertyType, ...propertyTypes]
              : propertyTypes
            ).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Field>
          <Field
            label="About you and your hosting plans"
            multiline
            minRows={3}
            value={form.about}
            onChange={set('about')}
            slotProps={{ htmlInput: { maxLength: 500, 'aria-label': 'About you and your hosting plans' } }}
          />
        </Box>
      </Box>

      <FormControlLabel
        control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
        label="I confirm the details above are true and I agree to the StayLang host terms."
        sx={{ mt: 1 }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          disabled={busy}
          onClick={submit}
          sx={{ borderRadius: '10px', px: 3, boxShadow: '0 4px 12px rgba(69,123,145,.3)' }}
        >
          {busy ? 'Sending…' : status === 'rejected' ? 'Reapply' : 'Submit application'}
        </Button>
      </Box>
    </Box>
  );
}