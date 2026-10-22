import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, ButtonBase, Chip, Dialog, IconButton, MenuItem, Rating, TextField, Typography,
} from '@mui/material';
import BathtubIcon from '@mui/icons-material/Bathtub';
import BedIcon from '@mui/icons-material/Bed';
import CloseIcon from '@mui/icons-material/Close';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Auth';
import { labelFont } from '../Theme';
import { usePropertyReviews } from '../Data';

const labelSx = { fontFamily: labelFont, fontWeight: 700, fontSize: '0.75rem', mt: 2.5, mb: 0.75 };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Dates are handled as local "YYYY-MM-DD" strings so time zones never shift them.
const pad = (n) => String(n).padStart(2, '0');
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = toISODate(new Date());
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function Details({ place, onClose }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [saved, setSaved] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const reviews = usePropertyReviews(place.id);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const images = place.images?.length ? place.images : place.image ? [place.image] : [];
  const isOwner = Boolean(user) && user.uid === place.ownerId;
  const nights =
    checkIn && checkOut ? Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000) : 0;
  const total = nights > 0 ? nights * place.pricePerNight : 0;

  // The check-out calendar only allows dates from the day after check-in
  // up to check-in plus the host's maximum stay.
  const minCheckout = checkIn ? addDays(checkIn, 1) : today;
  const maxCheckout = checkIn && place.maxStay ? addDays(checkIn, place.maxStay) : undefined;

  const handleCheckIn = (value) => {
    setCheckIn(value);
    setNotice(null);
    // Clear a check-out that no longer fits the new check-in date.
    if (value && checkOut) {
      const tooEarly = checkOut <= value;
      const tooLate = place.maxStay && checkOut > addDays(value, place.maxStay);
      if (tooEarly || tooLate) setCheckOut('');
    }
  };

  const facts = [
    { Icon: BedIcon, text: plural(place.bedrooms, 'bedroom') },
    { Icon: BedIcon, text: plural(place.beds, 'bed') },
    { Icon: BathtubIcon, text: plural(place.baths, 'bath') },
    { Icon: PeopleIcon, text: `Up to ${plural(place.capacity, 'guest')}` },
  ];

  const handleReserve = async () => {
    if (!user) {
      onClose();
      navigate('/login');
      return;
    }
    if (nights < 1) {
      setNotice({ severity: 'error', text: 'Choose a check-in date and a later check-out date.' });
      return;
    }
    if (place.maxStay && nights > place.maxStay) {
      setNotice({
        severity: 'error',
        text: `The maximum stay is ${plural(place.maxStay, 'night')}. Choose an earlier check-out date.`,
      });
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'reservations'), {
        propertyId: place.id,
        propertyTitle: place.name,
        ownerId: place.ownerId,
        guestId: user.uid,
        guestName: profile ? `${profile.firstName} ${profile.lastName}` : user.displayName || user.email,
        guestEmail: user.email,
        checkIn,
        checkOut,
        nights,
        guests,
        total,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setNotice({ severity: 'success', text: 'Request sent! You will get a message in your Inbox when the host replies.' });
    } catch {
      setNotice({ severity: 'error', text: 'Could not send your request. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ position: 'relative', p: { xs: 2, md: 4 } }}>
      <IconButton
        aria-label="Close"
        onClick={onClose}
        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'rgba(255,255,255,.85)' }}
      >
        <CloseIcon />
      </IconButton>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, gap: 4, alignItems: 'start' }}>
        {/* Left: photos + details */}
        <Box>
          {images.length > 0 ? (
            <Box
              component="img"
              src={images[imgIndex]}
              alt={place.name}
              sx={{ display: 'block', width: '100%', height: { xs: 220, md: 320 }, objectFit: 'cover', borderRadius: '12px', bgcolor: '#D9D9D9' }}
            />
          ) : (
            <Box sx={{ height: { xs: 220, md: 320 }, borderRadius: '12px', bgcolor: '#D9D9D9' }} />
          )}
          {images.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {images.map((src, i) => (
                <ButtonBase
                  key={i}
                  onClick={() => setImgIndex(i)}
                  aria-label={`Show photo ${i + 1}`}
                  sx={{ width: 64, height: 46, borderRadius: '6px', overflow: 'hidden', outline: i === imgIndex ? '2px solid #457B91' : '2px solid transparent' }}
                >
                  <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </ButtonBase>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mt: 2 }}>
            <Typography id="place-title" variant="h4" component="h2" sx={{ fontWeight: 500 }}>
              {place.name}
            </Typography>
            <IconButton
              aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={saved}
              onClick={() => setSaved((s) => !s)}
              sx={{ color: saved ? '#F2B705' : '#BDBDBD' }}
            >
              {saved ? <StarIcon fontSize="large" /> : <StarBorderIcon fontSize="large" />}
            </IconButton>
          </Box>

          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocationOnIcon fontSize="small" />
            {place.city}, {place.type}
          </Typography>
          {place.location && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 3 }}>
              {place.location}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {place.host && (
              <Chip size="small" label={`Hosted by ${place.host}`} sx={{ bgcolor: '#FBF1C0', fontFamily: labelFont, fontSize: '0.7rem' }} />
            )}
            {average !== null && (
              <Chip
                size="small"
                icon={<StarRoundedIcon />}
                label={`${average.toFixed(1)} (${plural(reviews.length, 'review')})`}
                sx={{ bgcolor: '#FBF1C0', fontFamily: labelFont, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          <Typography sx={labelSx}>Description:</Typography>
          <Typography>{place.description}</Typography>

          <Typography sx={labelSx}>Where you'll sleep</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {facts.map(({ Icon, text }) => (
              <Box
                key={text}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: '#fff', border: '1px solid #D9D9D9', borderRadius: '8px' }}
              >
                <Icon fontSize="small" />
                <Typography variant="body2">{text}</Typography>
              </Box>
            ))}
          </Box>

          {place.amenities.length > 0 && (
            <>
              <Typography sx={labelSx}>Amenities:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {place.amenities.map(({ key, label, Icon }) => (
                  <Chip key={key} size="small" variant="outlined" icon={<Icon />} label={label} sx={{ bgcolor: '#fff', fontFamily: labelFont, fontSize: '0.7rem' }} />
                ))}
              </Box>
            </>
          )}
        </Box>

        {/* Right: booking card + reviews */}
        <Box>
          <Box sx={{ bgcolor: '#fff', borderRadius: '12px', p: 2.5, border: '1px solid #E0E0E0' }}>
            <Typography component="div" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
              ${place.pricePerNight}
              <Typography component="span" variant="body2" sx={{ fontWeight: 400 }}> /night</Typography>
            </Typography>
            {place.maxStay ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Maximum stay: {plural(place.maxStay, 'night')}
              </Typography>
            ) : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.5 }}>
              <TextField
                size="small"
                type="date"
                label="Check-in"
                value={checkIn}
                onChange={(e) => handleCheckIn(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
              />
              <TextField
                size="small"
                type="date"
                label="Check-out"
                value={checkOut}
                disabled={!checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: minCheckout, ...(maxCheckout ? { max: maxCheckout } : {}) },
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
              {!checkIn
                ? 'Choose your check-in date first.'
                : maxCheckout
                  ? `Latest check-out: ${fmtDate(maxCheckout)}.`
                  : 'Now choose your check-out date.'}
            </Typography>

            <TextField
              select
              fullWidth
              size="small"
              label="Guests"
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              sx={{ mt: 1 }}
            >
              {Array.from({ length: Math.min(place.capacity || 1, 10) }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={n}>{plural(n, 'guest')}</MenuItem>
              ))}
            </TextField>

            {nights > 0 && (
              <Box sx={{ mt: 2, fontSize: '0.875rem' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>${place.pricePerNight} × {plural(nights, 'night')}</span>
                  <span>${total}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, mt: 0.5 }}>
                  <span>Total</span>
                  <span>${total}</span>
                </Box>
              </Box>
            )}

            {isOwner && <Alert severity="info" sx={{ mt: 2 }}>This is your property, so you can't book it.</Alert>}
            {notice && <Alert severity={notice.severity} sx={{ mt: 2 }}>{notice.text}</Alert>}

            <Button
              fullWidth
              variant="contained"
              startIcon={<EventAvailableIcon />}
              onClick={handleReserve}
              disabled={busy || isOwner || notice?.severity === 'success'}
              sx={{ mt: 2, borderRadius: '8px', py: 1 }}
            >
              {busy ? 'Sending…' : 'Reserve'}
            </Button>
          </Box>

          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
            Reviews
          </Typography>
          {reviews.length > 0 ? (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {reviews.map((r) => (
                <Box key={r.id} sx={{ bgcolor: '#fff', borderRadius: '12px', p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 600 }}>{r.guestName}</Typography>
                    <Rating value={r.rating} readOnly size="small" />
                  </Box>
                  {r.text && <Typography variant="body2" sx={{ mt: 0.5 }}>{r.text}</Typography>}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ bgcolor: '#fff', borderRadius: '12px', p: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>No reviews yet.</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// The modal. `place` stays set while the close animation plays.
export default function PropertyDetails({ place, open, onClose }) {
  if (!place) return null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      scroll="body"
      aria-labelledby="place-title"
      slotProps={{ paper: { sx: { bgcolor: '#F4F4F4', borderRadius: '16px' } } }}
    >
      <Details key={place.id} place={place} onClose={onClose} />
    </Dialog>
  );
}