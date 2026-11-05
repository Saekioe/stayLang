import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, InputAdornment, Switch, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { PageHeader, Panel, colors } from './adminUi';

// Change this if your properties store the category under a different field name
const CATEGORY_FIELD = 'category';

const DEFAULT_CATEGORIES = ['Apartment', 'Villa', 'Cabin', 'Loft', 'Beachhouse'];
const DEFAULT_PLATFORM = { guestFee: '0', hostFee: '0', maintenance: false, supportEmail: '' };
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
        guestFee: String(d.guestFee ?? 0),
        hostFee: String(d.hostFee ?? 0),
        maintenance: Boolean(d.maintenance),
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
    if (!removeTarget) return;
    await saveCategories(categories.filter((c) => c !== removeTarget), 'Category removed.');
    setRemoveTarget(null);
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const savePlatform = async () => {
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
      await setDoc(doc(db, 'settings', 'platform'), {
        guestFee,
        hostFee,
        maintenance: form.maintenance,
        supportEmail: form.supportEmail.trim(),
        updatedAt: serverTimestamp(),
      });
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
        subtitle="Control property categories, service fees and site availability across StayLang."
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
        <Panel title="Platform Settings" subtitle="Service fees, contact details and site availability">
          <Box sx={{ px: 2.75, pb: 3, display: 'grid', gap: 2.5 }}>
            {formError && <Alert severity="error" onClose={() => setFormError('')}>{formError}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                size="small"
                label="Guest service fee"
                type="number"
                value={form.guestFee}
                onChange={setField('guestFee')}
                helperText="Added on top of the booking price"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              />
              <TextField
                size="small"
                label="Host service fee"
                type="number"
                value={form.hostFee}
                onChange={setField('hostFee')}
                helperText="Taken from the host payout"
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

            <Box sx={{ border: `1px solid ${colors.line}`, borderRadius: '12px', px: 2, py: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.maintenance}
                    onChange={(e) => setForm((f) => ({ ...f, maintenance: e.target.checked }))}
                  />
                }
                label="Maintenance mode"
              />
              <Typography sx={{ fontSize: 12, color: colors.muted, ml: 6, mt: -0.5 }}>
                When on, guests and hosts should see a maintenance page. Admins can still log in.
              </Typography>
            </Box>

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
            {removeCount > 0
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
            disabled={busy || removeCount > 0}
          >
            {busy ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}