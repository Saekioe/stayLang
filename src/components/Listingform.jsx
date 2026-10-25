import { useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, InputAdornment, MenuItem, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import { amenityOptions, propertyTypes } from '../dataqueries/Data';

const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 850000; // keeps the whole document under Firestore's 1 MB limit

// Shrinks a photo in the browser and returns it as a small JPEG data URL.
function compressImage(file, maxSize = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

const empty = {
  title: '', city: '', location: '', type: 'Apartment', description: '',
  capacity: '', bedrooms: '', beds: '', baths: '', pricePerNight: '', maxStay: '30',
  amenities: [], images: [],
  hostName: '', hostEmail: '', hostPhone: '', hostBio: '',
};

const toNum = (v, fallback = 0) => (v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

// Every listing goes live when saved, so everything is required.
function validate(f) {
  if (!f.title.trim()) return 'Enter a property title.';
  if (!f.city.trim()) return 'Enter the city.';
  if (!f.location.trim()) return 'Enter the location.';
  if (!(toNum(f.capacity, NaN) >= 1)) return 'Capacity must be at least 1 guest.';
  if (!(toNum(f.bedrooms, NaN) >= 0)) return 'Enter the number of bedrooms (0 for a studio).';
  if (!(toNum(f.beds, NaN) >= 1)) return 'Enter at least 1 bed.';
  if (!(toNum(f.baths, NaN) >= 0)) return 'Enter the number of baths.';
  if (!(toNum(f.pricePerNight, NaN) > 0)) return 'Enter a base price per night.';
  if (!(toNum(f.maxStay, NaN) >= 1)) return 'Maximum stay must be at least 1 night.';
  if (!f.description.trim()) return 'Add a short description.';
  if (!f.hostName.trim()) return 'Enter the host name.';
  if (f.hostEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.hostEmail.trim())) {
    return 'Enter a valid contact email.';
  }
  if (f.images.length === 0) return 'Add at least one photo.';
  return '';
}

// Label above an outlined input, like the mockup.
function FormField({ label, htmlInput, input, ...props }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>{label}</Typography>
      <TextField
        fullWidth
        size="small"
        slotProps={{ htmlInput: { 'aria-label': label, ...htmlInput }, input }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#FBFAFA' } }}
        {...props}
      />
    </Box>
  );
}

function GroupLabel({ children }) {
  return (
    <Typography sx={{ fontWeight: 700, color: '#7A7070', fontSize: '0.85rem', mt: 1, mb: 1.5 }}>
      {children}
    </Typography>
  );
}

const cardSx = {
  bgcolor: '#fff',
  border: '1px solid #E6E3E3',
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(63,54,54,.06)',
  p: { xs: 2.5, md: 4 },
};

// `initial` = an existing listing (edit) or null (create).
export default function ListingForm({ initial, onDone, onCancel }) {
  const { user, profile } = useAuth();
  const isEdit = Boolean(initial?.id);
  // Host details start from the account and can be changed for each listing.
  const hostDefaults = {
    hostName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.displayName || '',
    hostEmail: user?.email || '',
    hostPhone: profile?.phone || '',
    hostBio: '',
  };
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...empty,
          ...initial,
          hostName: initial.hostName || hostDefaults.hostName,
          hostEmail: initial.hostEmail ?? hostDefaults.hostEmail,
          hostPhone: initial.hostPhone ?? hostDefaults.hostPhone,
          hostBio: initial.hostBio ?? '',
          capacity: String(initial.capacity ?? ''),
          bedrooms: String(initial.bedrooms ?? ''),
          beds: String(initial.beds ?? ''),
          baths: String(initial.baths ?? ''),
          pricePerNight: String(initial.pricePerNight ?? ''),
          maxStay: String(initial.maxStay ?? 30),
          amenities: initial.amenities ?? [],
          images: initial.images ?? [],
        }
      : { ...empty, ...hostDefaults }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const numberProps = { type: 'number', htmlInput: { min: 0 } };

  const toggleAmenity = (key) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(key) ? f.amenities.filter((k) => k !== key) : [...f.amenities, key],
    }));

  const addFiles = async (picked) => {
    const files = picked.filter((f) => f.type.startsWith('image/'));
    if (!files.length) return setError('Choose image files such as JPG or PNG.');
    setError('');
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) return setError(`You can add up to ${MAX_IMAGES} photos.`);
    try {
      const added = await Promise.all(files.slice(0, room).map((f) => compressImage(f)));
      setForm((f) => ({ ...f, images: [...f.images, ...added] }));
      if (files.length > room) setError(`Only ${MAX_IMAGES} photos are allowed, so some were skipped.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length) addFiles(picked);
  };

  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const save = async () => {
    const message = validate(form);
    if (message) return setError(message);
    if (form.images.reduce((sum, s) => sum + s.length, 0) > MAX_IMAGE_CHARS) {
      return setError('The photos are too large together. Remove one or use smaller photos.');
    }
    setError('');
    setBusy(true);

    const data = {
      title: form.title.trim(),
      city: form.city.trim(),
      location: form.location.trim(),
      type: form.type,
      description: form.description.trim(),
      capacity: toNum(form.capacity, 1),
      bedrooms: toNum(form.bedrooms),
      beds: toNum(form.beds),
      baths: toNum(form.baths),
      pricePerNight: toNum(form.pricePerNight),
      maxStay: toNum(form.maxStay, 30),
      amenities: form.amenities,
      images: form.images,
      published: true, // listings are live as soon as they are saved
      hostName: form.hostName.trim(),
      hostBio: form.hostBio.trim(),
      hostEmail: form.hostEmail.trim(),
      hostPhone: form.hostPhone.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'properties', initial.id), data);
      } else {
        await addDoc(collection(db, 'properties'), {
          ...data,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      onDone();
    } catch {
      setError('Could not save your listing. Please try again.');
      setBusy(false);
    }
  };

  const atLimit = form.images.length >= MAX_IMAGES;

  return (
    <Box sx={{ backgroundColor: '#ffffff', p: { xs: 2, md: 0 }, borderRadius: '16px', boxShadow: '0 1px 3px rgba(63,54,54,.06)', mb: 4, maxWidth: 1800, mx: 'auto' }}>
      <Typography sx={{ color: '#7A7070', fontWeight: 500 }}>StayLang Host</Typography>
      <Typography
        component="h1"
        sx={{ fontSize: { xs: '2rem', md: '2.2rem' }, lineHeight: 1.1, mt: 0.5, color: '#000000', fontWeight: 600 }}
      >
        {isEdit ? 'Edit your Listing' : 'Create your Listing'}
      </Typography>
      <Typography sx={{ color: '#7A7070', mt: 1, mb: 2.5 }}>
        {isEdit
          ? 'Update the details below. Your changes go live when you save.'
          : 'Fill in the details below. Your listing goes live as soon as you publish it.'}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.3fr' }, gap: 3, alignItems: 'start' }}>
        {/* Left card */}
        <Box sx={cardSx}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2, color: '#292929' }}>
            Listing details
          </Typography>
          <FormField label="Property Title" value={form.title} onChange={set('title')} />
          <FormField label="City" value={form.city} onChange={set('city')} />
          <FormField label="Location" multiline minRows={3} value={form.location} onChange={set('location')} />

          <GroupLabel>Rooms and capacity</GroupLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
            <FormField label="Capacity" value={form.capacity} onChange={set('capacity')} {...numberProps} />
            <FormField label="Bedrooms" value={form.bedrooms} onChange={set('bedrooms')} {...numberProps} />
            <FormField label="Beds" value={form.beds} onChange={set('beds')} {...numberProps} />
            <FormField label="Baths" value={form.baths} onChange={set('baths')} {...numberProps} />
          </Box>

          <GroupLabel>Pricing</GroupLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <FormField
              label="Base Price per Night"
              value={form.pricePerNight}
              onChange={set('pricePerNight')}
              type="number"
              htmlInput={{ min: 0 }}
              input={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
            <FormField
              label="Maximum Stay"
              value={form.maxStay}
              onChange={set('maxStay')}
              type="number"
              htmlInput={{ min: 1 }}
              input={{ endAdornment: <InputAdornment position="end">nights</InputAdornment> }}
            />
          </Box>

          <GroupLabel>Host information</GroupLabel>
          <Typography variant="caption" sx={{ display: 'block', color: '#7A7070', mt: -1, mb: 1.5 }}>
            Guests see this on your listing. Leave the contact details empty to keep them private.
          </Typography>
          <FormField label="Host name" value={form.hostName} onChange={set('hostName')} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <FormField label="Contact email (optional)" value={form.hostEmail} onChange={set('hostEmail')} type="email" />
            <FormField label="Contact phone (optional)" value={form.hostPhone} onChange={set('hostPhone')} type="tel" />
          </Box>
          <FormField
            label="About the host (optional)"
            multiline
            minRows={2}
            value={form.hostBio}
            onChange={set('hostBio')}
            htmlInput={{ maxLength: 400 }}
          />
        </Box>

        {/* Right card */}
        <Box sx={cardSx}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2, color: '#292929' }}>
            Photos and amenities
          </Typography>

          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>Add Images</Typography>
          <Box
            component="label"
            onDragOver={(e) => {
              e.preventDefault();
              if (!atLimit) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!atLimit) addFiles(Array.from(e.dataTransfer.files));
            }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              p: 3,
              textAlign: 'center',
              cursor: atLimit ? 'default' : 'pointer',
              border: `2px solid ${dragging ? '#457B91' : '#B9D0D9'}`,
              bgcolor: dragging ? '#DCEAEF' : '#E8F1F4',
              borderRadius: '14px',
              transition: 'background-color .15s, border-color .15s',
              '&:hover': { bgcolor: atLimit ? '#E8F1F4' : '#DCEAEF' },
              '&:focus-within': { outline: '2px solid #457B91', outlineOffset: 2 },
            }}
          >
            <CloudUploadIcon sx={{ color: '#457B91' }} />
            <Typography sx={{ fontWeight: 600 }}>
              {atLimit ? 'You have added the maximum number of photos' : 'Click to upload or drag photos here'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#7A7070' }}>
              Up to {MAX_IMAGES} photos. The first one becomes the cover.
            </Typography>
            <input type="file" accept="image/*" multiple hidden disabled={atLimit} onChange={handleFiles} />
          </Box>

          {form.images.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
              {form.images.map((src, i) => (
                <Box key={i} sx={{ position: 'relative', width: 116, height: 84 }}>
                  <Box
                    component="img"
                    src={src}
                    alt={`Photo ${i + 1}`}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => removeImage(i)}
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,.92)', p: 0.25, '&:hover': { bgcolor: '#fff' } }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  {i === 0 && (
                    <Chip
                      size="small"
                      label="Cover"
                      sx={{ position: 'absolute', left: 6, bottom: 6, height: 20, bgcolor: '#FBF1C0', fontSize: '0.7rem', fontWeight: 600 }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          )}

          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mt: 3, mb: 1 }}>Amenities</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {amenityOptions.map(({ key, label, Icon }) => {
              const on = form.amenities.includes(key);
              return (
                <Chip
                  key={key}
                  icon={<Icon />}
                  label={label}
                  clickable
                  color={on ? 'primary' : 'default'}
                  variant={on ? 'filled' : 'outlined'}
                  onClick={() => toggleAmenity(key)}
                  aria-pressed={on}
                  sx={on ? undefined : { borderColor: '#E6E3E3', bgcolor: '#FBFAFA' }}
                />
              );
            })}
          </Box>

          <FormField label="Property Type" select value={form.type} onChange={set('type')}>
            {propertyTypes.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </FormField>
          <FormField label="Description" multiline minRows={3} value={form.description} onChange={set('description')} />
        </Box>
      </Box>

      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 3,
          py: 1.5,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          bgcolor: '#fff',
          borderTop: '1px solid #E6E3E3',
        }}
      >
        {onCancel && <Button color="inherit" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <Button
          variant="contained"
          disabled={busy}
          onClick={save}
          sx={{ borderRadius: '10px', boxShadow: '0 4px 12px rgba(69,123,145,.3)' }}
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Publish'}
        </Button>
      </Box>
    </Box>
  );
}