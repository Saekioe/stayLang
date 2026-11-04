import { useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, InputAdornment, MenuItem, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HomeIcon from '@mui/icons-material/Home';
import HotelIcon from '@mui/icons-material/Hotel';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CollectionsIcon from '@mui/icons-material/Collections';
import SecurityIcon from '@mui/icons-material/Security';
import GavelIcon from '@mui/icons-material/Gavel';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import { amenityOptions, propertyTypes } from '../dataqueries/Data';

const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per original photo
const MAX_IMAGE_CHARS = 850000; // total for all photos, keeps the doc under 1 MB


const SAFETY_FEATURES = [
  { key: 'smokeAlarm', label: 'Smoke alarm' },
  { key: 'coAlarm', label: 'Carbon monoxide alarm' },
  { key: 'firstAid', label: 'First aid kit' },
  { key: 'fireExtinguisher', label: 'Fire extinguisher' },
];

function compressImage(file, maxSize = 800, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
  capacity: '', bedrooms: '', beds: '', baths: '', pricePerNight: '', maxStay: '30', cleaningFee: '0',
  amenities: [], images: [],
  checkInTime: '14:00', checkOutTime: '11:00', houseRules: '',
  safetyFeatures: [],
};

const toNum = (v, fallback = 0) => (v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

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
  if (!(toNum(f.cleaningFee, 0) >= 0)) return 'Cleaning fee cannot be negative.';
  if (!f.description.trim()) return 'Add a short description.';
  if (!f.checkInTime.trim()) return 'Specify a check-in time.';
  if (!f.checkOutTime.trim()) return 'Specify a check-out time.';
  if (!f.houseRules.trim()) return 'Enter house rules for guests.';
  if (f.safetyFeatures.length === 0) return 'Select at least one safety feature.';
  if (!f.images.length) return 'Add at least one photo.';
  return '';
}

function FormField({ label, htmlInput, input, ...props }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.75, color: '#4A5568' }}>
        {label}
      </Typography>
      <TextField
        required
        fullWidth
        size="small"
        slotProps={{ htmlInput: { 'aria-label': label, ...htmlInput }, input }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            backgroundColor: '#F8FAFC',
            transition: 'all 0.2s ease',
            '& fieldset': { borderColor: '#E2E8F0' },
            '&:hover fieldset': { borderColor: '#CBD5E1' },
            '&.Mui-focused fieldset': { borderColor: '#0F4A5F', borderWidth: '1.5px' },
          },
        }}
        {...props}
      />
    </Box>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
      <Box sx={{ p: 0.85, borderRadius: '8px', backgroundColor: '#E2F1F4', color: '#0F4A5F', display: 'flex' }}>
        <Icon fontSize="small" />
      </Box>
      <Typography sx={{ fontWeight: 700, color: '#1E293B', fontSize: '1.05rem', letterSpacing: '0.01em' }}>
        {title}
      </Typography>
    </Box>
  );
}

const cardSx = {
  backgroundColor: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '16px',
  p: { xs: 2.5, md: 3.5 },
};

export default function ListingForm({ initial, onDone, onCancel }) {
  const { user } = useAuth();
  const isEdit = Boolean(initial?.id);
  const [activeTab, setActiveTab] = useState(0);

  const [form, setForm] = useState(() =>
    initial
      ? {
          ...empty,
          ...initial,
          checkInTime: initial.checkInTime ?? '14:00',
          checkOutTime: initial.checkOutTime ?? '11:00',
          houseRules: initial.houseRules ?? '',
          safetyFeatures: initial.safetyFeatures ?? [],
          capacity: String(initial.capacity ?? ''),
          bedrooms: String(initial.bedrooms ?? ''),
          beds: String(initial.beds ?? ''),
          baths: String(initial.baths ?? ''),
          pricePerNight: String(initial.pricePerNight ?? ''),
          maxStay: String(initial.maxStay ?? 30),
          cleaningFee: String(initial.cleaningFee ?? 0),
          amenities: initial.amenities ?? [],
          images: initial.images ?? [],
        }
      : { ...empty }
  );

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const numberProps = { type: 'number', htmlInput: { min: 0 } };

  const toggleArrayItem = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((k) => k !== value) : [...f[key], value],
    }));

  const addFiles = async (picked) => {
  const files = picked.filter((f) => f.type.startsWith('image/'));
  if (!files.length) return setError('Choose image files such as JPG or PNG.');
  setError('');

  const room = MAX_IMAGES - form.images.length;
  if (room <= 0) return setError(`You can add up to ${MAX_IMAGES} photos.`);

  const selected = files.slice(0, room);
  const tooBig = selected.find((f) => f.size > MAX_FILE_SIZE);
  if (tooBig) return setError(`${tooBig.name} is over the 10 MB limit.`);

  try {
    setBusy(true);
    const added = await Promise.all(selected.map((f) => compressImage(f)));
    setForm((prev) => ({ ...prev, images: [...prev.images, ...added] }));
    if (files.length > room) setError(`Only ${MAX_IMAGES} photos are allowed, so some were skipped.`);
  } catch (err) {
    setError(err.message || 'Could not process the images.');
  } finally {
    setBusy(false);
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
      cleaningFee: toNum(form.cleaningFee, 0),
      amenities: form.amenities,
      images: form.images,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      houseRules: form.houseRules.trim(),
      safetyFeatures: form.safetyFeatures,
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'properties', initial.id), data);
      } else {
        await addDoc(collection(db, 'properties'), {
          ...data,
          published: true,
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
    <Box 
      sx={{ 
        position: 'relative',
        backgroundColor: '#FFFFFF',
        p: { xs: 3, md: 5 }, 
        borderRadius: '20px', 
        maxWidth: 960, 
        mx: 'auto', 
        border: '1px solid #E2E8F0', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)' 
      }}
    >
      {/* Top Close Button for Easy Navigation */}
      {(onCancel || onDone) && (
        <IconButton
          aria-label="Close form"
          onClick={onCancel || onDone}
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: '#64748B',
            backgroundColor: '#F1F5F9',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: '#E2E8F0',
              color: '#0F4A5F',
              transform: 'scale(1.05)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      )}

      {/* Form Header */}
      <Box sx={{ mb: 3, pr: 6 }}>
        <Typography sx={{ color: '#0F4A5F', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Host Property Editor
        </Typography>
        <Typography component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, mt: 0.5, color: '#0F172A', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {isEdit ? 'Edit Property Listing' : 'Create New Listing'}
        </Typography>
      </Box>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        sx={{
          mb: 4,
          borderBottom: '1px solid #E2E8F0',
          '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem', color: '#64748B', py: 1.5 },
          '& .Mui-selected': { color: '#0F4A5F !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#0F4A5F', height: 3, borderRadius: '3px 3px 0 0' },
        }}
      >
        <Tab label="1. Basic Info & Capacity" />
        <Tab label="2. Pricing & Rules" />
        <Tab label="3. Photos & Features" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

      {/* Tab 1: Basic Info & Rooms */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={cardSx}>
            <SectionTitle icon={HomeIcon} title="Property Overview" />
            <FormField label="Property Title" placeholder="e.g., Cozy Modern Studio in Makati" value={form.title} onChange={set('title')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <FormField label="City" placeholder="e.g., Manila" value={form.city} onChange={set('city')} />
              <FormField label="Property Type" select value={form.type} onChange={set('type')}>
                {propertyTypes.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </FormField>
            </Box>
            <FormField label="Detailed Location / Address" placeholder="Street address or neighborhood landmark" multiline minRows={2} value={form.location} onChange={set('location')} />
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={HotelIcon} title="Rooms & Capacity" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              <FormField label="Capacity" value={form.capacity} onChange={set('capacity')} {...numberProps} />
              <FormField label="Bedrooms" value={form.bedrooms} onChange={set('bedrooms')} {...numberProps} />
              <FormField label="Beds" value={form.beds} onChange={set('beds')} {...numberProps} />
              <FormField label="Baths" value={form.baths} onChange={set('baths')} {...numberProps} />
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab 2: Pricing & Rules */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={cardSx}>
            <SectionTitle icon={AttachMoneyIcon} title="Pricing Details" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <FormField
                label="Base Price per Night"
                value={form.pricePerNight}
                onChange={set('pricePerNight')}
                type="number"
                htmlInput={{ min: 0 }}
                input={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
              />
              <FormField
                label="Cleaning Fee (Per stay)"
                value={form.cleaningFee}
                onChange={set('cleaningFee')}
                type="number"
                htmlInput={{ min: 0 }}
                input={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
              />
            </Box>
            <FormField
              label="Maximum Stay Duration"
              value={form.maxStay}
              onChange={set('maxStay')}
              type="number"
              htmlInput={{ min: 1 }}
              input={{ endAdornment: <InputAdornment position="end">nights</InputAdornment> }}
            />
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={GavelIcon} title="Check-in & House Rules" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <FormField label="Check-in Time" type="time" value={form.checkInTime} onChange={set('checkInTime')} />
              <FormField label="Check-out Time" type="time" value={form.checkOutTime} onChange={set('checkOutTime')} />
            </Box>
            <FormField label="House Rules" placeholder="e.g., Quiet hours after 10 PM, No smoking inside." multiline minRows={3} value={form.houseRules} onChange={set('houseRules')} />
          </Box>
        </Box>
      )}

      {/* Tab 3: Photos, Amenities & Safety */}
      {activeTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={cardSx}>
            <SectionTitle icon={CollectionsIcon} title="Property Photos" />
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
                gap: 1.5,
                p: 4,
                textAlign: 'center',
                cursor: atLimit ? 'default' : 'pointer',
                border: `2px dashed ${dragging ? '#0F4A5F' : '#CBD5E1'}`,
                backgroundColor: dragging ? '#E2F1F4' : '#FFFFFF',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                '&:hover': { backgroundColor: atLimit ? '#FFFFFF' : '#F1F5F9' },
              }}
            >
              <CloudUploadIcon sx={{ color: '#0F4A5F', fontSize: '2.4rem' }} />
              <Typography sx={{ fontWeight: 600, color: '#1E293B', fontSize: '0.95rem' }}>
                {atLimit ? 'Maximum photo limit reached' : 'Click to upload or drag photos here'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                Up to {MAX_IMAGES} photos. The first image will be set as cover.
              </Typography>
              <input type="file" accept="image/*" multiple hidden disabled={atLimit} onChange={handleFiles} />
            </Box>

            {form.images.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2.5 }}>
                {form.images.map((src, i) => (
                  <Box key={i} sx={{ position: 'relative', width: 110, height: 80 }}>
                    <Box component="img" src={src} alt={`Photo ${i + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    <IconButton size="small" onClick={() => removeImage(i)} sx={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF', p: 0.35, '&:hover': { backgroundColor: 'rgba(0,0,0,0.85)' } }}>
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    {i === 0 && (
                      <Chip size="small" label="Cover" sx={{ position: 'absolute', left: 4, bottom: 4, height: 18, backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '0.6rem', fontWeight: 700 }} />
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={SecurityIcon} title="Safety & Description" />
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1.25, color: '#4A5568' }}>Safety Equipment</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 3 }}>
              {SAFETY_FEATURES.map(({ key, label }) => {
                const on = form.safetyFeatures.includes(key);
                return (
                  <Chip
                    key={key}
                    label={label}
                    clickable
                    onClick={() => toggleArrayItem('safetyFeatures', key)}
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 500,
                      px: 0.5,
                      ...(on 
                        ? { backgroundColor: '#0F4A5F', color: '#FFFFFF', fontWeight: 700 } 
                        : { backgroundColor: '#FFFFFF', color: '#4A5568', border: '1px solid #E2E8F0', '&:hover': { backgroundColor: '#F1F5F9' } }
                      )
                    }}
                  />
                );
              })}
            </Box>

            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1.25, color: '#4A5568' }}>Available Amenities</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 3 }}>
              {amenityOptions.map(({ key, label, Icon }) => {
                const on = form.amenities.includes(key);
                return (
                  <Chip
                    key={key}
                    icon={Icon ? <Icon /> : undefined}
                    label={label}
                    clickable
                    onClick={() => toggleArrayItem('amenities', key)}
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 500,
                      px: 0.5,
                      ...(on 
                        ? { backgroundColor: '#0F4A5F', color: '#FFFFFF', fontWeight: 700, '& .MuiChip-icon': { color: '#FFFFFF' } } 
                        : { backgroundColor: '#FFFFFF', color: '#4A5568', border: '1px solid #E2E8F0', '& .MuiChip-icon': { color: '#4A5568' }, '&:hover': { backgroundColor: '#F1F5F9' } }
                      )
                    }}
                  />
                );
              })}
            </Box>

            <FormField label="About this Space" placeholder="Describe your property..." multiline minRows={3} value={form.description} onChange={set('description')} />
          </Box>
        </Box>
      )}

      {/* Footer Navigation & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, pt: 3, borderTop: '1px solid #E2E8F0' }}>
        <Button
          disabled={activeTab === 0}
          onClick={() => setActiveTab((prev) => Math.max(0, prev - 1))}
          sx={{ color: '#64748B', fontWeight: 600, '&.Mui-disabled': { color: '#CBD5E1' } }}
        >
          Previous
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          

          {activeTab < 2 ? (
            <Button 
              variant="contained" 
              onClick={() => setActiveTab((prev) => Math.min(2, prev + 1))} 
              sx={{ borderRadius: '10px', backgroundColor: '#0F4A5F', color: '#FFFFFF', fontWeight: 700, px: 3.5, py: 1, '&:hover': { backgroundColor: '#135E7A' } }}
            >
              Next Step
            </Button>
          ) : (
            <Button 
              variant="contained" 
              disabled={busy} 
              onClick={save} 
              sx={{ borderRadius: '10px', backgroundColor: '#0F4A5F', color: '#FFFFFF', fontWeight: 700, px: 3.5, py: 1, '&:hover': { backgroundColor: '#135E7A' } }}
            >
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Listing'}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}