import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Rating,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import BathtubOutlinedIcon from '@mui/icons-material/BathtubOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// MUI X Date Pickers imports
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Auth';
import { labelFont } from '../Theme';

const labelSx = {
  fontFamily: labelFont,
  fontWeight: 700,
  fontSize: '0.85rem',
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  mt: 3,
  mb: 1.5,
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Details({ place, onClose }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, profile } = useAuth();

  const [saved, setSaved] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [checkIn, setCheckIn] = useState(null); // dayjs object or null
  const [checkOut, setCheckOut] = useState(null); // dayjs object or null
  const [guests, setGuests] = useState(1);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const images = place.images?.length ? place.images : place.image ? [place.image] : [];
  const isOwner = Boolean(user) && user.uid === place.ownerId;

  // Calculate total nights and price using dayjs
  const nights = checkIn && checkOut && checkOut.isAfter(checkIn)
    ? checkOut.diff(checkIn, 'day')
    : 0;

  const total = nights > 0 ? nights * place.pricePerNight : 0;

  const handleCheckInChange = (newValue) => {
    setCheckIn(newValue);
    setNotice(null);

    // Reset check-out if it violates constraints relative to the new check-in date
    if (newValue && checkOut) {
      const isInvalidCheckout =
        checkOut.isSame(newValue, 'day') ||
        checkOut.isBefore(newValue, 'day') ||
        (place.maxStay && checkOut.diff(newValue, 'day') > place.maxStay);

      if (isInvalidCheckout) {
        setCheckOut(null);
      }
    }
  };

  const handleCheckOutChange = (newValue) => {
    setCheckOut(newValue);
    setNotice(null);
  };

  const facts = [
    { Icon: BedOutlinedIcon, text: plural(place.bedrooms, 'bedroom') },
    { Icon: BedOutlinedIcon, text: plural(place.beds, 'bed') },
    { Icon: BathtubOutlinedIcon, text: plural(place.baths, 'bath') },
    { Icon: PeopleOutlinedIcon, text: `Up to ${plural(place.capacity, 'guest')}` },
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
        checkIn: checkIn.format('YYYY-MM-DD'),
        checkOut: checkOut.format('YYYY-MM-DD'),
        nights,
        guests,
        total,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setNotice({
        severity: 'success',
        text: 'Request sent! You will get a message in your Inbox when the host replies.',
      });
    } catch {
      setNotice({ severity: 'error', text: 'Could not send your request. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  // Date picker minimum & maximum boundaries
  const minCheckIn = dayjs();
  const minCheckOut = checkIn ? checkIn.add(1, 'day') : dayjs().add(1, 'day');
  const maxCheckOut = checkIn && place.maxStay ? checkIn.add(place.maxStay, 'day') : undefined;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 4 } }}>
        {/* Floating Close Button */}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          <CloseIcon />
        </IconButton>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' },
            gap: 4,
            alignItems: 'start',
          }}
        >
          {/* LEFT: Photos & Property Info */}
          <Box>
            {/* Main Featured Photo */}
            <Paper
              elevation={0}
              sx={{
                position: 'relative',
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: 'grey.200',
                height: { xs: 240, sm: 360, md: 420 },
              }}
            >
              {images.length > 0 ? (
                <Box
                  component="img"
                  src={images[imgIndex]}
                  alt={place.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
                  }}
                >
                  No photos available
                </Box>
              )}
            </Paper>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                {images.map((src, i) => (
                  <ButtonBase
                    key={i}
                    onClick={() => setImgIndex(i)}
                    aria-label={`Show photo ${i + 1}`}
                    sx={{
                      width: 72,
                      height: 54,
                      borderRadius: 2,
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: i === imgIndex ? '0 0 0 3px #457B91' : 'none',
                      opacity: i === imgIndex ? 1 : 0.7,
                      transition: 'all 0.2s ease',
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <Box
                      component="img"
                      src={src}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </ButtonBase>
                ))}
              </Box>
            )}

            {/* Title & Favorite Button */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mt: 3 }}>
              <Box>
                <Typography id="place-title" variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                  {place.name}
                </Typography>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <LocationOnIcon fontSize="small" color="action" />
                  {place.city}{place.location ? `, ${place.location}` : ''} • {place.type}
                </Typography>
              </Box>

              <IconButton
                aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={saved}
                onClick={() => setSaved((s) => !s)}
                sx={{
                  color: saved ? '#F2B705' : 'text.disabled',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              >
                {saved ? <StarIcon fontSize="large" /> : <StarBorderIcon fontSize="large" />}
              </IconButton>
            </Box>

            {/* Host & Rating Badges */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {place.host && (
                <Chip
                  size="medium"
                  label={`Hosted by ${place.host}`}
                  variant="outlined"
                  sx={{ fontWeight: 500 }}
                />
              )}
              {place.rating && (
                <Chip
                  size="medium"
                  icon={<StarRoundedIcon sx={{ color: '#F2B705 !important' }} />}
                  label={`${place.rating} Rating`}
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Description */}
            <Typography sx={{ fontWeight: 800 }}>Description</Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
              {place.description}
            </Typography>

            {/* Where you'll sleep / Room details */}
            <Typography sx={{ fontWeight: 800 }}>Where you'll sleep</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
              {facts.map(({ Icon, text }) => (
                <Paper
                  key={text}
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Icon color="action" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {text}
                  </Typography>
                </Paper>
              ))}
            </Box>

            {/* Amenities */}
            {place.amenities?.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 800 }}>Amenities</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {place.amenities.map(({ key, label, Icon }) => (
                    <Chip
                      key={key}
                      icon={Icon ? <Icon /> : <CheckCircleIcon />}
                      label={label}
                      variant="outlined"
                      sx={{ borderRadius: 2, py: 2, px: 0.5 }}
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>

          {/* RIGHT: Booking Card with Calendar */}
          <Box sx={{ position: { lg: 'sticky' }, top: 20 }}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {/* Pricing Header */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography component="span" sx={{ fontSize: '1.75rem', fontWeight: 800 }}>
                    ${place.pricePerNight}
                  </Typography>
                  <Typography component="span" color="text.secondary">
                    {' '}/ night
                  </Typography>
                </Box>

                {place.maxStay && (
                  <Chip
                    size="small"
                    label={`Max stay: ${plural(place.maxStay, 'night')}`}
                    color="default"
                    variant="outlined"
                  />
                )}
              </Box>

              {/* MUI Date Pickers */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <DatePicker
                    label="Check-in"
                    value={checkIn}
                    onChange={handleCheckInChange}
                    minDate={minCheckIn}
                    slotProps={{
                      textField: { size: 'small', fullWidth: true },
                    }}
                  />
                  <DatePicker
                    label="Check-out"
                    value={checkOut}
                    disabled={!checkIn}
                    onChange={handleCheckOutChange}
                    minDate={minCheckOut}
                    maxDate={maxCheckOut}
                    slotProps={{
                      textField: { size: 'small', fullWidth: true },
                    }}
                  />
                </Box>

                {/* Helper / Info Text */}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {!checkIn
                    ? 'Select your check-in date.'
                    : maxCheckOut
                    ? `Max checkout available: ${maxCheckOut.format('MMM D, YYYY')}.`
                    : 'Select your check-out date.'}
                </Typography>

                {/* Guests Selector */}
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Guests"
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                >
                  {Array.from({ length: Math.min(place.capacity || 1, 10) }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>
                      {plural(n, 'guest')}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              {/* Price Breakdown */}
              {nights > 0 && (
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary', mb: 1 }}>
                    <Typography variant="body2">
                      ${place.pricePerNight} × {plural(nights, 'night')}
                    </Typography>
                    <Typography variant="body2">${total}</Typography>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Total
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                      ${total}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Feedback Notifications */}
              {isOwner && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  This is your property, so you cannot book it.
                </Alert>
              )}
              {notice && (
                <Alert severity={notice.severity} sx={{ mt: 2, borderRadius: 2 }}>
                  {notice.text}
                </Alert>
              )}

              {/* Reserve Button */}
              <Button
                fullWidth
                size="large"
                variant="contained"
                startIcon={<EventAvailableIcon />}
                onClick={handleReserve}
                disabled={busy || isOwner || notice?.severity === 'success'}
                sx={{
                  mt: 3,
                  py: 1.5,
                  borderRadius: 3,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: 2,
                }}
              >
                {busy ? 'Sending request…' : 'Reserve Now'}
              </Button>
            </Paper>

            {/* Reviews Section */}
            <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
              Guest Reviews
            </Typography>

            {place.reviews?.length > 0 ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {place.reviews.map((r, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>{r.author}</Typography>
                      <Rating value={r.rating} precision={0.5} size="small" readOnly />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {r.text}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No reviews yet for this property.
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}

// Modal dialog wrapper
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
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.default',
            borderRadius: { xs: 2, md: 4 },
          },
        },
      }}
    >
      <Details key={place.id} place={place} onClose={onClose} />
    </Dialog>
  );
}