import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, InputAdornment, MenuItem,
  Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HomeIcon from '@mui/icons-material/Home';
import HotelIcon from '@mui/icons-material/Hotel';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CollectionsIcon from '@mui/icons-material/Collections';
import SecurityIcon from '@mui/icons-material/Security';
import GavelIcon from '@mui/icons-material/Gavel';
import GroupIcon from '@mui/icons-material/Group';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import {
  collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import { amenityOptions, usePropertyTypes } from '../dataqueries/Data';

const MAX_IMAGES = 4;
const MIN_IMAGES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per original photo
const MAX_IMAGE_CHARS = 850000; // total for all photos, keeps the doc under 1 MB
const MAX_DOC_CHARS = 700000; // proof document (stored in its own private doc)

const PLACE_TYPES = ['Entire place', 'Private room', 'Shared room'];

const CAMERA_OPTIONS = [
  { value: 'none', label: 'No security cameras' },
  { value: 'exterior', label: 'Outdoor cameras only (entrances, driveway)' },
  { value: 'common', label: 'Cameras in shared indoor areas (never in bedrooms or bathrooms)' },
];

const PROOF_TYPES = [
  'Land title or tax declaration',
  'Lease contract with owner permission',
  'Recent utility bill in your name',
  'Business permit or DOT accreditation',
];

const DECLARATIONS = [
  { key: 'rights', label: 'I own this place or have the legal right to rent it out.' },
  { key: 'accurate', label: 'All details and photos are accurate and show the actual place.' },
  { key: 'laws', label: 'I will follow local laws and any building or barangay rules for short-term stays.' },
];

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
  title: '', type: '', placeType: 'Entire place', description: '', hostBio: '',
  street: '', barangay: '', city: '', province: '', postalCode: '',
  maxAdults: '', maxChildren: '0', maxInfants: '0', petsAllowed: false, maxPets: '1',
  bedrooms: '', beds: '', baths: '',
  pricePerNight: '', maxStay: '30', cleaningFee: '0',
  amenities: [], images: [],
  checkInTime: '14:00', checkOutTime: '11:00', houseRules: '',
  smokingAllowed: false, eventsAllowed: false, cameras: 'none',
  safetyFeatures: [],
  proofType: PROOF_TYPES[0], proofDoc: '',
  declarations: { rights: false, accurate: false, laws: false },
};

const toNum = (v, fallback = 0) => (v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

// Returns { tab, message } for the first problem, or null when everything is fine.
function validate(f, { needsProof }) {
  const bad = (tab, message) => ({ tab, message });
  if (!f.title.trim()) return bad(0, 'Enter a property title.');
  if (!f.type) return bad(0, 'Choose a property type.');
  if (!f.street.trim()) return bad(0, 'Enter the street address or building name.');
  if (!f.barangay.trim()) return bad(0, 'Enter the barangay.');
  if (!f.city.trim()) return bad(0, 'Enter the city.');
  if (!f.province.trim()) return bad(0, 'Enter the province.');
  if (!/^\d{4}$/.test(f.postalCode.trim())) return bad(0, 'Enter a 4-digit postal code.');
  if (!f.description.trim()) return bad(0, 'Add a short description.');

  if (!(toNum(f.maxAdults, NaN) >= 1)) return bad(1, 'At least 1 adult must be allowed.');
  if (!(toNum(f.maxChildren, NaN) >= 0)) return bad(1, 'Enter the number of children allowed (0 if none).');
  if (!(toNum(f.maxInfants, NaN) >= 0)) return bad(1, 'Enter the number of infants allowed (0 if none).');
  if (f.petsAllowed && !(toNum(f.maxPets, NaN) >= 1)) return bad(1, 'Enter how many pets are allowed.');
  if (!(toNum(f.bedrooms, NaN) >= 0)) return bad(1, 'Enter the number of bedrooms (0 for a studio).');
  if (!(toNum(f.beds, NaN) >= 1)) return bad(1, 'Enter at least 1 bed.');
  if (!(toNum(f.baths, NaN) >= 0)) return bad(1, 'Enter the number of baths.');

  if (!(toNum(f.pricePerNight, NaN) > 0)) return bad(2, 'Enter a base price per night.');
  if (!(toNum(f.maxStay, NaN) >= 1)) return bad(2, 'Maximum stay must be at least 1 night.');
  if (!(toNum(f.cleaningFee, 0) >= 0)) return bad(2, 'Cleaning fee cannot be negative.');
  if (!f.checkInTime.trim()) return bad(2, 'Specify a check-in time.');
  if (!f.checkOutTime.trim()) return bad(2, 'Specify a check-out time.');
  if (!f.houseRules.trim()) return bad(2, 'Enter house rules for guests.');

  if (f.images.length < MIN_IMAGES) return bad(3, `Add at least ${MIN_IMAGES} photos.`);
  if (f.safetyFeatures.length === 0) return bad(3, 'Select at least one safety feature.');
  if (needsProof && !f.proofDoc) return bad(3, 'Upload a proof document so we can verify your listing.');
  if (!Object.values(f.declarations).every(Boolean)) return bad(3, 'Please accept all three declarations.');
  return null;
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

const hintSx = { fontSize: '0.78rem', color: '#64748B', mt: -1.5, mb: 2 };

export default function ListingForm({ initial, onDone, onCancel }) {
  const { user, profile } = useAuth();
  const propertyTypes = usePropertyTypes();
  const isEdit = Boolean(initial?.id);
  const wasRejected = initial?.verificationStatus === 'rejected';
  const [activeTab, setActiveTab] = useState(0);

  const [form, setForm] = useState(() =>
    initial
      ? {
          ...empty,
          ...initial,
          placeType: initial.placeType ?? 'Entire place',
          hostBio: initial.hostBio ?? '',
          street: initial.street ?? '',
          barangay: initial.barangay ?? '',
          province: initial.province ?? '',
          postalCode: initial.postalCode ?? '',
          maxAdults: String(initial.maxAdults ?? initial.capacity ?? ''),
          maxChildren: String(initial.maxChildren ?? 0),
          maxInfants: String(initial.maxInfants ?? 0),
          petsAllowed: Boolean(initial.petsAllowed),
          maxPets: String(initial.maxPets ?? 1),
          bedrooms: String(initial.bedrooms ?? ''),
          beds: String(initial.beds ?? ''),
          baths: String(initial.baths ?? ''),
          pricePerNight: String(initial.pricePerNight ?? ''),
          maxStay: String(initial.maxStay ?? 30),
          cleaningFee: String(initial.cleaningFee ?? 0),
          checkInTime: initial.checkInTime ?? '14:00',
          checkOutTime: initial.checkOutTime ?? '11:00',
          houseRules: initial.houseRules ?? '',
          smokingAllowed: Boolean(initial.smokingAllowed),
          eventsAllowed: Boolean(initial.eventsAllowed),
          cameras: initial.cameras ?? 'none',
          safetyFeatures: initial.safetyFeatures ?? [],
          amenities: initial.amenities ?? [],
          images: initial.images ?? [],
          proofType: PROOF_TYPES[0],
          proofDoc: '', // the stored proof is private; only a new upload replaces it
          declarations: initial.declarationsAcceptedAt
            ? { rights: true, accurate: true, laws: true }
            : { rights: false, accurate: false, laws: false },
        }
      : { ...empty }
  );

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // A new listing starts on the first category the admin offers.
  useEffect(() => {
    if (!isEdit && !form.type && propertyTypes.length) {
      setForm((f) => (f.type ? f : { ...f, type: propertyTypes[0] }));
    }
  }, [isEdit, form.type, propertyTypes]);

  // An older listing may use a category the admin has since removed. Keep it selectable.
  const typeOptions = form.type && !propertyTypes.includes(form.type) ? [form.type, ...propertyTypes] : propertyTypes;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));
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

  const handleProof = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Upload the proof as a photo or scan (JPG or PNG).');
    if (file.size > MAX_FILE_SIZE) return setError('The proof document is over the 10 MB limit.');
    try {
      setBusy(true);
      const dataUrl = await compressImage(file, 1400, 0.7);
      if (dataUrl.length > MAX_DOC_CHARS) {
        setError('That document is too large after processing. Try a clearer, smaller photo.');
      } else {
        setError('');
        setForm((f) => ({ ...f, proofDoc: dataUrl }));
      }
    } catch (err) {
      setError(err.message || 'Could not process the document.');
    } finally {
      setBusy(false);
    }
  };

  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const save = async () => {
    const problem = validate(form, { needsProof: !isEdit });
    if (problem) {
      setActiveTab(problem.tab);
      return setError(problem.message);
    }
    if (form.images.reduce((sum, s) => sum + s.length, 0) > MAX_IMAGE_CHARS) {
      setActiveTab(3);
      return setError('The photos are too large together. Remove one or use smaller photos.');
    }
    setError('');
    setBusy(true);

    const maxAdults = toNum(form.maxAdults, 1);
    const maxChildren = toNum(form.maxChildren, 0);

    const data = {
      title: form.title.trim(),
      type: form.type,
      placeType: form.placeType,
      description: form.description.trim(),
      // Shown on the property page ("Hosted by ..."): first name and last initial, like reviews
      hostName: profile
        ? `${profile.firstName ?? ''} ${profile.lastName?.charAt(0) ?? ''}.`.replace(/ \.$/, '').trim()
        : user.displayName || '',
      hostBio: form.hostBio.trim(),
      street: form.street.trim(),
      barangay: form.barangay.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
      // Full address string, kept so the rest of the app that reads `location` still works
      location: [form.street, form.barangay, form.city, form.province, form.postalCode]
        .map((s) => s.trim()).filter(Boolean).join(', '),
      maxAdults,
      maxChildren,
      maxInfants: toNum(form.maxInfants, 0),
      petsAllowed: form.petsAllowed,
      maxPets: form.petsAllowed ? toNum(form.maxPets, 1) : 0,
      capacity: maxAdults + maxChildren, // infants and pets don't count toward capacity
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
      smokingAllowed: form.smokingAllowed,
      eventsAllowed: form.eventsAllowed,
      cameras: form.cameras,
      safetyFeatures: form.safetyFeatures,
      declarationsAcceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEdit) {
        // After a rejection, saving sends the listing back to the admin's queue.
        if (wasRejected) {
          data.verificationStatus = 'pending';
          data.submittedAt = serverTimestamp();
        }
        await updateDoc(doc(db, 'properties', initial.id), data);
        if (form.proofDoc) {
          await setDoc(doc(db, 'propertyDocs', initial.id), {
            ownerId: user.uid,
            propertyId: initial.id,
            proofType: form.proofType,
            proofDoc: form.proofDoc,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } else {
        // New listings are never live: they wait for admin verification.
        const ref = doc(collection(db, 'properties'));
        const batch = writeBatch(db);
        batch.set(ref, {
          ...data,
          published: false,
          verificationStatus: 'pending',
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          submittedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'propertyDocs', ref.id), {
          ownerId: user.uid,
          propertyId: ref.id,
          proofType: form.proofType,
          proofDoc: form.proofDoc,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
      onDone();
    } catch {
      setError('Could not save your listing. Please try again.');
      setBusy(false);
    }
  };

  const atLimit = form.images.length >= MAX_IMAGES;
  const lastTab = 3;

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
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      }}
    >
      {(onCancel || onDone) && (
        <IconButton
          aria-label="Close form"
          onClick={onCancel || onDone}
          sx={{
            position: 'absolute', top: 20, right: 20, color: '#64748B', backgroundColor: '#F1F5F9',
            transition: 'all 0.2s ease',
            '&:hover': { backgroundColor: '#E2E8F0', color: '#0F4A5F', transform: 'scale(1.05)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      )}

      <Box sx={{ mb: 3, pr: 6 }}>
        <Typography sx={{ color: '#0F4A5F', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Host Property Editor
        </Typography>
        <Typography component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, mt: 0.5, color: '#0F172A', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {isEdit ? 'Edit Property Listing' : 'Register Your Property'}
        </Typography>
        {!isEdit && (
          <Typography sx={{ color: '#64748B', fontSize: '0.9rem', mt: 0.5 }}>
            Our team reviews every new listing before it goes live. This usually takes a short while.
          </Typography>
        )}
      </Box>

      {wasRejected && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: '10px' }}>
          Your listing was not approved{initial.rejectionReason ? `: ${initial.rejectionReason}` : '.'} Fix the
          issue and save to send it for review again.
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 4,
          borderBottom: '1px solid #E2E8F0',
          '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem', color: '#64748B', py: 1.5 },
          '& .Mui-selected': { color: '#0F4A5F !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#0F4A5F', height: 3, borderRadius: '3px 3px 0 0' },
        }}
      >
        <Tab label="1. Basics & Address" />
        <Tab label="2. Guests & Rooms" />
        <Tab label="3. Pricing & Rules" />
        <Tab label="4. Photos & Verification" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

      {/* Tab 1: Basics & Address */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={cardSx}>
            <SectionTitle icon={HomeIcon} title="Property Overview" />
            <FormField label="Property Title" placeholder="e.g., Cozy Modern Studio in Makati" value={form.title} onChange={set('title')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <FormField label="Property Type" select value={form.type} onChange={set('type')}>
                {typeOptions.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </FormField>
              <FormField label="What will guests have?" select value={form.placeType} onChange={set('placeType')}>
                {PLACE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </FormField>
            </Box>
            <FormField label="About this Space" placeholder="Describe your property, the neighborhood and what makes it special..." multiline minRows={3} value={form.description} onChange={set('description')} />
            <FormField
              label="About you as a host (optional)"
              placeholder="A short hello for your guests."
              multiline
              minRows={2}
              required={false}
              value={form.hostBio}
              onChange={set('hostBio')}
              htmlInput={{ maxLength: 300 }}
            />
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={LocationOnIcon} title="Address" />
            <Typography sx={hintSx}>
              The exact address is checked by our team. Guests only see it after their booking is confirmed.
            </Typography>
            <FormField label="Street / Building / Unit" placeholder="e.g., Unit 12B, Sunrise Tower, Ayala Ave." value={form.street} onChange={set('street')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <FormField label="Barangay" value={form.barangay} onChange={set('barangay')} />
              <FormField label="City / Municipality" value={form.city} onChange={set('city')} />
              <FormField label="Province" value={form.province} onChange={set('province')} />
              <FormField label="Postal Code" placeholder="e.g., 1226" value={form.postalCode} onChange={set('postalCode')} htmlInput={{ maxLength: 4, inputMode: 'numeric' }} />
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab 2: Guests & Rooms */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={cardSx}>
            <SectionTitle icon={GroupIcon} title="Who Can Stay" />
            <Typography sx={hintSx}>
              Set how many of each guest type you allow. Infants and pets do not count toward your
              guest capacity.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <FormField label="Adults (age 13 and up)" value={form.maxAdults} onChange={set('maxAdults')} {...numberProps} htmlInput={{ min: 1 }} />
              <FormField label="Children (ages 2 to 12)" value={form.maxChildren} onChange={set('maxChildren')} {...numberProps} />
              <FormField label="Infants (under 2)" value={form.maxInfants} onChange={set('maxInfants')} {...numberProps} />
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.75, color: '#4A5568' }}>Pets</Typography>
                <FormControlLabel
                  control={<Switch checked={form.petsAllowed} onChange={setBool('petsAllowed')} />}
                  label={form.petsAllowed ? 'Pets allowed' : 'No pets'}
                />
                {form.petsAllowed && (
                  <FormField label="Maximum pets" value={form.maxPets} onChange={set('maxPets')} {...numberProps} htmlInput={{ min: 1 }} />
                )}
              </Box>
            </Box>
            <Typography sx={{ fontSize: '0.85rem', color: '#0F4A5F', fontWeight: 600 }}>
              Total guest capacity: {toNum(form.maxAdults) + toNum(form.maxChildren)}
            </Typography>
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={HotelIcon} title="Rooms" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              <FormField label="Bedrooms" value={form.bedrooms} onChange={set('bedrooms')} {...numberProps} />
              <FormField label="Beds" value={form.beds} onChange={set('beds')} {...numberProps} />
              <FormField label="Baths" value={form.baths} onChange={set('baths')} {...numberProps} />
            </Box>
          </Box>
        </Box>
      )}

      {/* Tab 3: Pricing & Rules */}
      {activeTab === 2 && (
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
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2.5 }}>
              <FormControlLabel control={<Switch checked={form.smokingAllowed} onChange={setBool('smokingAllowed')} />} label="Smoking allowed" />
              <FormControlLabel control={<Switch checked={form.eventsAllowed} onChange={setBool('eventsAllowed')} />} label="Parties or events allowed" />
            </Box>
            <FormField label="Security cameras (required disclosure)" select value={form.cameras} onChange={set('cameras')}>
              {CAMERA_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </FormField>
            <FormField label="Other House Rules" placeholder="e.g., Quiet hours after 10 PM, no shoes inside." multiline minRows={3} value={form.houseRules} onChange={set('houseRules')} />
          </Box>
        </Box>
      )}

      {/* Tab 4: Photos, Safety & Verification */}
      {activeTab === 3 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          <Box sx={cardSx}>
            <SectionTitle icon={CollectionsIcon} title="Property Photos" />
            <Box
              component="label"
              onDragOver={(e) => { e.preventDefault(); if (!atLimit) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!atLimit) addFiles(Array.from(e.dataTransfer.files));
              }}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, p: 4, textAlign: 'center',
                cursor: atLimit ? 'default' : 'pointer',
                border: `2px dashed ${dragging ? '#0F4A5F' : '#CBD5E1'}`,
                backgroundColor: dragging ? '#E2F1F4' : '#FFFFFF',
                borderRadius: '12px', transition: 'all 0.2s ease',
                '&:hover': { backgroundColor: atLimit ? '#FFFFFF' : '#F1F5F9' },
              }}
            >
              <CloudUploadIcon sx={{ color: '#0F4A5F', fontSize: '2.4rem' }} />
              <Typography sx={{ fontWeight: 600, color: '#1E293B', fontSize: '0.95rem' }}>
                {atLimit ? 'Maximum photo limit reached' : 'Click to upload or drag photos here'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                {MIN_IMAGES} to {MAX_IMAGES} photos. The first image will be set as cover.
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
            <SectionTitle icon={SecurityIcon} title="Safety & Amenities" />
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
                      borderRadius: '8px', fontWeight: 500, px: 0.5,
                      ...(on
                        ? { backgroundColor: '#0F4A5F', color: '#FFFFFF', fontWeight: 700 }
                        : { backgroundColor: '#FFFFFF', color: '#4A5568', border: '1px solid #E2E8F0', '&:hover': { backgroundColor: '#F1F5F9' } }),
                    }}
                  />
                );
              })}
            </Box>

            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1.25, color: '#4A5568' }}>Available Amenities</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
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
                      borderRadius: '8px', fontWeight: 500, px: 0.5,
                      ...(on
                        ? { backgroundColor: '#0F4A5F', color: '#FFFFFF', fontWeight: 700, '& .MuiChip-icon': { color: '#FFFFFF' } }
                        : { backgroundColor: '#FFFFFF', color: '#4A5568', border: '1px solid #E2E8F0', '& .MuiChip-icon': { color: '#4A5568' }, '&:hover': { backgroundColor: '#F1F5F9' } }),
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={VerifiedUserIcon} title="Verification" />
            <Typography sx={hintSx}>
              Only our review team can see your document. It is never shown to guests.
            </Typography>
            <FormField label="Proof document type" select value={form.proofType} onChange={set('proofType')}>
              {PROOF_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </FormField>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              disabled={busy}
              sx={{ borderRadius: '10px', mb: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
              {form.proofDoc ? 'Replace document' : isEdit ? 'Upload a new document (optional)' : 'Upload document'}
              <input type="file" accept="image/*" hidden onChange={handleProof} />
            </Button>
            {form.proofDoc && (
              <Box component="img" src={form.proofDoc} alt="Proof document preview"
                sx={{ display: 'block', maxWidth: 220, maxHeight: 160, borderRadius: '8px', border: '1px solid #E2E8F0', mb: 2 }} />
            )}
            {isEdit && !form.proofDoc && (
              <Typography sx={{ fontSize: '0.8rem', color: '#64748B', mb: 2 }}>
                Your earlier document is kept on file.
              </Typography>
            )}

            {DECLARATIONS.map(({ key, label }) => (
              <FormControlLabel
                key={key}
                sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}
                control={
                  <Checkbox
                    checked={form.declarations[key]}
                    onChange={(e) => setForm((f) => ({ ...f, declarations: { ...f.declarations, [key]: e.target.checked } }))}
                    sx={{ pt: 0.5 }}
                  />
                }
                label={<Typography sx={{ fontSize: '0.88rem', color: '#334155' }}>{label}</Typography>}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, pt: 3, borderTop: '1px solid #E2E8F0' }}>
        <Button
          disabled={activeTab === 0}
          onClick={() => setActiveTab((prev) => Math.max(0, prev - 1))}
          sx={{ color: '#64748B', fontWeight: 600, '&.Mui-disabled': { color: '#CBD5E1' } }}
        >
          Previous
        </Button>

        {activeTab < lastTab ? (
          <Button
            variant="contained"
            onClick={() => setActiveTab((prev) => Math.min(lastTab, prev + 1))}
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
            {busy ? 'Saving…' : wasRejected ? 'Resubmit for review' : isEdit ? 'Save Changes' : 'Submit for review'}
          </Button>
        )}
      </Box>
    </Box>
  );
}