import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { PageHeader, Panel, colors } from './adminUi';
import { DEFAULT_PROPERTY_TYPES } from '../../dataqueries/Data';

// Listings store their category in `type` (see ListingForm).
const CATEGORY_FIELD = 'type';

// Same list hosts see until the admin saves their own.
const DEFAULT_CATEGORIES = DEFAULT_PROPERTY_TYPES;
// 10 matches DEFAULT_SERVICE_FEE_PERCENT in Booking.js, so the form shows the fee guests really pay.
const DEFAULT_PLATFORM = { guestFee: '10', hostFee: '0', supportEmail: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Settings() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [properties, setProperties] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [catError, setCatError] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);

  const [saved, setSaved] = useState(DEFAULT_PLATFORM);
  const [form, setForm] = useState(DEFAULT_PLATFORM);
  const [formError, setFormError] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubCats = onSnapshot(doc(db, 'settings', 'categories'), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().items)) {
        setCategories(snap.data().items);
      }
    }, () => setError('Failed to load categories.'));

    const unsubPlatform = onSnapshot(doc(db, 'settings', 'platform'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const next = {
        guestFee: String(d.guestFee ?? d.serviceFeePercent ?? 10),
        hostFee: String(d.hostFee ?? 0),
        supportEmail: d.supportEmail ?? '',
      };
      setSaved(next);
      setForm(next);
    }, () => setError('Failed to load platform settings.'));

    const unsubProps = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => d.data()));
    }, () => {});

    return () => {
      unsubCats();
      unsubPlatform();
      unsubProps();
    };
  }, []);

  const usage = useMemo(() => {
    const map = {};
    properties.forEach((p) => {
      const key = p[CATEGORY_FIELD];
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [properties]);

  const saveCategories = async (items, message) => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'settings', 'categories'), { items, updatedAt: serverTimestamp() });
      setSuccess(message);
      return true;
    } catch (err) {
      console.error(err);
      setError(`Could not save categories: ${err.code || err.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAddCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    if (name.length > 30) return setCatError('Keep the name under 30 characters.');
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return setCatError('That category already exists.');
    }
    setCatError('');
    const ok = await saveCategories([...categories, name], 'Category added.');
    if (ok) setNewCat('');
  };

  const confirmRemove = async () => {
    if (!removeTarget || categories.length <= 1) return;
    await saveCategories(categories.filter((c) => c !== removeTarget), 'Category removed.');
    setRemoveTarget(null);
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const savePlatform = async () => {
    // Number('') is 0, so an empty box would silently save a 0% fee.
    if ([form.guestFee, form.hostFee].some((v) => String(v).trim() === '')) {
      return setFormError('Enter both fees (type 0 for no fee).');
    }
    const guestFee = Number(form.guestFee);
    const hostFee = Number(form.hostFee);
    if ([guestFee, hostFee].some((n) => Number.isNaN(n) || n < 0 || n > 100)) {
      return setFormError('Fees must be a number from 0 to 100.');
    }
    if (form.supportEmail.trim() && !EMAIL_RE.test(form.supportEmail.trim())) {
      return setFormError('Enter a valid support email.');
    }
    setFormError('');
    setBusy(true);
    try {
      // merge: true keeps any other field on the document. serviceFeePercent is kept equal to
      // guestFee so the payment server and the booking screens always read the same number.
      await setDoc(doc(db, 'settings', 'platform'), {
        guestFee,
        serviceFeePercent: guestFee,
        hostFee,
        supportEmail: form.supportEmail.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSuccess('Platform settings saved.');
    } catch (err) {
      console.error(err);
      setError(`Could not save settings: ${err.code || err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const removeCount = removeTarget ? usage[removeTarget] || 0 : 0;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <PageHeader
        title="Categories & Platform Settings"
        subtitle="Control property categories and service fees across Pahinga."
      />

      <Panel title="Manage Property Categories" subtitle="Add and remove categories used to organize properties">
        <Box sx={{ px: 2.75, pb: 3 }}>
          <Typography sx={{ fontSize: 13, color: colors.muted, mb: 1 }}>Category name</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mb: catError ? 0.5 : 3 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="New category name"
              value={newCat}
              error={Boolean(catError)}
              onChange={(e) => { setNewCat(e.target.value); setCatError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '99px', fontSize: 14, bgcolor: '#fff', height: 40 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.line },
              }}
            />
            <Button
              variant="contained"
              disableElevation
              disabled={busy}
              onClick={handleAddCategory}
              startIcon={<AddOutlinedIcon />}
              sx={{
                bgcolor: colors.dark, borderRadius: '99px', px: 2.5, height: 40,
                fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#082E2E' },
              }}
            >
              Add Category
            </Button>
          </Box>
          {catError && (
            <Typography sx={{ fontSize: 12, color: colors.danger, mb: 2.5, ml: 1.5 }}>{catError}</Typography>
          )}

          <Typography sx={{ fontSize: 13, color: colors.muted, mb: 1 }}>
            Existing categories ({categories.length})
          </Typography>
          <Box sx={{ border: `1px solid ${colors.line}`, borderRadius: '14px', overflow: 'hidden' }}>
            {categories.length === 0 && (
              <Typography sx={{ fontSize: 14, color: colors.muted, p: 2, textAlign: 'center' }}>
                No categories yet.
              </Typography>
            )}
            {categories.map((c, i) => (
              <Box
                key={c}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  height: 56.5, px: 1.75,
                  borderBottom: i === categories.length - 1 ? 'none' : `1px solid ${colors.line}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <SellOutlinedIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                  <Typography sx={{ fontSize: 14, color: colors.body }}>{c}</Typography>
                  <Typography sx={{ fontSize: 12, color: colors.muted }}>
                    {usage[c] || 0} {usage[c] === 1 ? 'property' : 'properties'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => setRemoveTarget(c)}
                  startIcon={<DeleteOutlineIcon sx={{ fontSize: '16px !important' }} />}
                  sx={{
                    color: colors.danger, borderColor: colors.line, borderRadius: '99px',
                    fontSize: 13, fontWeight: 500, px: 1.5,
                    '&:hover': { borderColor: colors.danger, bgcolor: 'transparent' },
                  }}
                >
                  Remove
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      </Panel>

      <Box sx={{ mt: 3 }}>
        <Panel title="Platform Settings" subtitle="Service fees and contact details">
          <Box sx={{ px: 2.75, pb: 3, display: 'grid', gap: 2.5 }}>
            {formError && <Alert severity="error" onClose={() => setFormError('')}>{formError}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                size="small"
                label="Guest service fee"
                type="number"
                value={form.guestFee}
                onChange={setField('guestFee')}
                helperText="Added on top of the booking price. Applies to new booking requests; existing bookings keep the fee they were requested with."
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              />
              <TextField
                size="small"
                label="Host service fee"
                type="number"
                value={form.hostFee}
                onChange={setField('hostFee')}
                helperText="Taken from the host's earnings (nights + cleaning fee). Applies to new booking requests only."
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              />
            </Box>

            <TextField
              size="small"
              label="Support email"
              value={form.supportEmail}
              onChange={setField('supportEmail')}
              helperText="Shown to users, for example on the suspended account message"
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button disabled={!dirty || busy} onClick={() => { setForm(saved); setFormError(''); }}>
                Reset
              </Button>
              <Button variant="contained" disableElevation disabled={!dirty || busy} onClick={savePlatform}>
                {busy ? 'Saving...' : 'Save changes'}
              </Button>
            </Box>
          </Box>
        </Panel>
      </Box>

      <Dialog open={Boolean(removeTarget)} onClose={() => !busy && setRemoveTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600, color: 'black' }}>
          Remove "{removeTarget}"?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: colors.muted }}>
            {categories.length <= 1
              ? 'Keep at least one category so hosts can still list a property.'
              : removeCount > 0
              ? `${removeCount} ${removeCount === 1 ? 'property uses' : 'properties use'} this category. Move them to another category first.`
              : 'Hosts will no longer be able to pick this category for new listings.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)} disabled={busy}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmRemove}
            disabled={busy || removeCount > 0 || categories.length <= 1}
          >
            {busy ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}