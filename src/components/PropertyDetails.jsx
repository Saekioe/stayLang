
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  Collapse,
} from '@mui/material';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import PeopleIcon from '@mui/icons-material/People';
import BedIcon from '@mui/icons-material/Bed';
import BathtubIcon from '@mui/icons-material/Bathtub';
import WifiIcon from '@mui/icons-material/Wifi';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOn';

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../firebase/firebase';
import { useAuth } from '../auth/Auth';
import { usePropertyReviews } from '../dataqueries/Data';

import {
  computeQuote,
  money,
  nightsBetween,
  useBookedNights,
  usePlatformSettings,
} from '../dataqueries/Booking';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const pad = (n) => String(n).padStart(2, '0');

const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const today = toISODate(new Date());

const addDays = (iso, n) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + n);
  return toISODate(date);
};

function Details({ place, onClose }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [saved, setSaved] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);

  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const reviews = usePropertyReviews(place.id);

  const images = place.images?.length
    ? place.images
    : place.image
      ? [place.image]
      : [];

  const isOwner = Boolean(user) && user.uid === place.ownerId;

  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(checkOut) - new Date(checkIn)) / 86400000
        )
      : 0;

  const { serviceFeePercent } = usePlatformSettings();
  const bookedNights = useBookedNights(place.id);

  const quote = computeQuote({
    pricePerNight: place.pricePerNight,
    nights,
    cleaningFee: place.cleaningFee,
    serviceFeePercent,
  });

  const minCheckout = checkIn ? addDays(checkIn, 1) : today;

  const maxCheckout =
    checkIn && place.maxStay
      ? addDays(checkIn, place.maxStay)
      : undefined;

  const stayIsFree = (ci, co) => {
    if (!ci || !co || co <= ci) return false;

    return nightsBetween(ci, co).every(
      (date) => !bookedNights.includes(date)
    );
  };

  const handleCheckIn = (value) => {
    setCheckIn(value);
    setNotice(null);

    if (value && checkOut) {
      const tooEarly = checkOut <= value;
      const tooLate =
        place.maxStay && checkOut > addDays(value, place.maxStay);
      const taken = !stayIsFree(value, checkOut);

      if (tooEarly || tooLate || taken) {
        setCheckOut('');
      }
    }
  };

  const handlePreviousImage = () => {
    setImgIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  };

  const handleNextImage = () => {
    setImgIndex((current) =>
      current === images.length - 1 ? 0 : current + 1
    );
  };

  const facts = [
    {
      Icon: PeopleIcon,
      text: `Sleeps ${place.capacity || 1}`,
    },
    {
      Icon: BedIcon,
      text: `${place.beds || 1} ${Number(place.beds || 1) === 1 ? 'King' : 'Beds'}`,
    },
    {
      Icon: BathtubIcon,
      text: `${place.baths || 1} Bath${Number(place.baths || 1) === 1 ? '' : 's'}`,
    },
    ...(place.area
      ? [{ Icon: null, text: `${place.area} m²` }]
      : []),
  ];

  const handleReserve = async () => {
    if (!user) {
      onClose();
      navigate('/login');
      return;
    }

    if (nights < 1) {
      setNotice({
        severity: 'error',
        text: 'Choose a check-in date and a later check-out date.',
      });
      return;
    }

    if (place.maxStay && nights > place.maxStay) {
      setNotice({
        severity: 'error',
        text: `The maximum stay is ${plural(place.maxStay, 'night')}.`,
      });
      return;
    }

    if (
      nightsBetween(checkIn, checkOut).some((date) =>
        bookedNights.includes(date)
      )
    ) {
      setNotice({
        severity: 'error',
        text: 'Some of those nights are unavailable. Please choose different dates.',
      });
      return;
    }

    setBusy(true);

    try {
      const mine = await getDocs(
        query(
          collection(db, 'reservations'),
          where('guestId', '==', user.uid),
          where('propertyId', '==', place.id)
        )
      );

      const clash = mine.docs.some((doc) => {
        const reservation = doc.data();

        return (
          (reservation.status === 'pending' ||
            reservation.status === 'confirmed') &&
          reservation.checkIn < checkOut &&
          reservation.checkOut > checkIn
        );
      });

      if (clash) {
        setNotice({
          severity: 'error',
          text: 'You already have a request for this place that overlaps these dates.',
        });
        return;
      }

      await addDoc(collection(db, 'reservations'), {
        propertyId: place.id,
        propertyTitle: place.name,
        ownerId: place.ownerId,

        guestId: user.uid,
        guestName: profile
          ? `${profile.firstName} ${profile.lastName}`
          : user.displayName || user.email,

        guestEmail: user.email,
        guestPhone: profile?.phone || '',

        checkIn,
        checkOut,
        nights,
        guests,

        nightlyRate: quote.nightlyRate,
        subtotal: quote.subtotal,
        cleaningFee: quote.cleaningFee,
        serviceFeePercent: quote.serviceFeePercent,
        serviceFee: quote.serviceFee,
        total: quote.total,

        currency: 'PHP',
        paymentStatus: 'unpaid',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setNotice({
        severity: 'success',
        text: 'Request sent! You will get a message in your Inbox when the host replies.',
      });
    } catch (error) {
      console.error('Reservation error:', error);

      setNotice({
        severity: 'error',
        text: 'Could not send your request. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const amenityIcon = (amenity) => {
    if (amenity.Icon) {
      const Icon = amenity.Icon;
      return <Icon sx={{ fontSize: 19 }} />;
    }

    if (/wifi|internet/i.test(amenity.label || '')) {
      return <WifiIcon sx={{ fontSize: 19 }} />;
    }

    return null;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ bgcolor: '#f5f5f300', color: '#252525' }}>

        {/* HEADER */}
        <Box
          sx={{
            height: 42,
            bgcolor: '#8b8b0d00',
            display: 'flex',
            alignItems: 'left',
            justifyContent: 'left',
            px: 2.5,
          }}
        >
          <IconButton
            onClick={onClose}
            aria-label="Close"
            size="small"
            sx={{ color: '#050505' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* IMAGE GALLERY */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: 240, sm: 320, md: 390 },
            bgcolor: '#D8D8D8',
            overflow: 'hidden',
          }}
        >
          {images.length > 0 ? (
            <Box
              component="img"
              src={images[imgIndex]}
              alt={place.name || 'Property'}
              loading="eager"
              decoding="async"
              sx={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Typography color="text.secondary">
                No image available
              </Typography>
            </Box>
          )}

          {/* Previous image */}
          {images.length > 1 && (
            <IconButton
              onClick={handlePreviousImage}
              aria-label="Previous image"
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#FFFFFF',
                bgcolor: 'rgba(0,0,0,0.25)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
              }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
          )}

          {/* Next image */}
          {images.length > 1 && (
            <IconButton
              onClick={handleNextImage}
              aria-label="Next image"
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#FFFFFF',
                bgcolor: 'rgba(0,0,0,0.25)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
              }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          )}

          {/* Image count */}
          {images.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 14,
                px: 1.5,
                py: 0.5,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#FFFFFF',
                borderRadius: 1,
                fontSize: '0.75rem',
              }}
            >
              {imgIndex + 1} / {images.length}
            </Box>
          )}
        </Box>


        {/* PROPERTY INFORMATION */}
        <Box
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            py: { xs: 2.5, sm: 3 },
            bgcolor: '#F5F5F3',
          }}
        >
          {/* Title and favorite */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
              mb: 1,
            }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.8rem' },
                fontWeight: 600,
                color: '#202020',
                textTransform: 'uppercase',
              }}
            >
              {place.name}
            </Typography>

            <IconButton
              onClick={() => setSaved((previous) => !previous)}
              aria-label="Toggle favorite"
              sx={{ color: saved ? '#E5A900' : '#777777' }}
            >
              {saved ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Box>

          {/* Location */}
          {place.location && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 1.5,
                color: '#777777',
              }}
            >
              <LocationOnIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: '0.8rem' }}>
                {place.location}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1, borderBottom: '1px solid #DDDDDD', pb: 1 }}> 
            <Typography sx={{ fontSize: '0.82rem' }}>
              - What's included
            </Typography>
          </Box>

          {/* Property facts */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1.5, sm: 2.5 },
              mb: 2,
              color: '#777D89',
              p: 1,
            }}
          >
            {facts.map(({ Icon, text }, index) => (
              <Box
                key={text}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.7,
                  pr: 2,
                  
                }}
              >
                <Box></Box>
                {Icon && <Icon sx={{ fontSize: 18 }} />}

                <Typography sx={{ fontSize: '0.78rem', }}>
                  {text}
                </Typography>

                {index !== facts.length - 1 && (
                  <Box
                    sx={{
                      width: 4,
                      height: 15,
                      bgcolor: '#C8C8C8',
                      ml: { xs: 0.5, sm: 1 },
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>

          <Box sx={{ my: 1, borderBottom: '1px solid #DDDDDD', pb: 1 }}>
            <Typography sx={{ fontSize: '0.82rem' }}>
              - Description
            </Typography>
          </Box>

          {/* Description */}
          <Typography
            sx={{
              color: '#555B65',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              mb: 3,
            }}
          >
            {place.description || 'No description provided.'}
          </Typography>
            
            <Box sx={{ my: 1, borderBottom: '1px solid #DDDDDD', pb: 1 }}> <Typography sx={{ fontSize: '0.82rem' }}> - Amenities </Typography> </Box> 

          {/* Amenities */}
          {place.amenities?.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
                columnGap: 2,
                rowGap: 2,
              }}
            >
              {place.amenities.map((amenity, index) => (
                <Box
                  key={amenity.key || `${amenity.label}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.2,
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ color: '#30343B', pt: 0.1 }}>
                    {amenityIcon(amenity)}
                  </Box>

                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      color: '#333333',
                      lineHeight: 1.5,
                    }}
                  >
                    {amenity.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Host */}
          {place.host && (
            <Box
              sx={{
                mt: 3,
                pt: 2,
                borderTop: '4px solid #DDDDDD',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Avatar sx={{ width: 38, height: 38 }}>
                {place.host.charAt(0).toUpperCase()}
              </Avatar>

              <Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Hosted by {place.host}
                </Typography>

                {place.hostBio && (
                  <Typography
                    sx={{ fontSize: '0.75rem', color: '#777777' }}
                  >
                    {place.hostBio}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* DIRECT RATE / BOOKING SECTION */}
        <Box
          sx={{
            bgcolor: '#FFFFFF',
            borderTop: '1px solid #E2E2E2',
            px: { xs: 2.5, sm: 3.5 },
            py: 3,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#292929',
              mb: 1,
            }}
          >
            Direct Rate
          </Typography>

          <Typography
            sx={{
              fontSize: '0.8rem',
              lineHeight: 1.5,
              color: '#555555',
              maxWidth: 500,
              mb: 2,
            }}
          >
            {place.rateDescription ||
              'Book your stay directly and enjoy your time at this property.'}
          </Typography>

          {/* Booking benefits */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mb: 2.5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.7,
                bgcolor: '#E7EAF0',
                color: '#525B6B',
                borderRadius: 5,
                px: 1.3,
                py: 0.7,
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: '0.68rem' }}>
                Booking request required
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.7,
                bgcolor: '#E7EAF0',
                color: '#525B6B',
                borderRadius: 5,
                px: 1.3,
                py: 0.7,
              }}
            >
              <CreditCardOutlinedIcon sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: '0.68rem' }}>
                Payment details confirmed later
              </Typography>
            </Box>
          </Box>

          {/* DATE SELECTION */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
              },
              gap: 1.5,
              mb: 2,
            }}
          >
            <DatePicker
              label="Check-in"
              value={checkIn ? dayjs(checkIn) : null}
              onChange={(value) =>
                handleCheckIn(
                  value?.isValid()
                    ? value.format('YYYY-MM-DD')
                    : ''
                )
              }
              minDate={dayjs(today)}
              shouldDisableDate={(date) =>
                bookedNights.includes(date.format('YYYY-MM-DD'))
              }
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'medium',
                  placeholder: 'Select arrival date',
                },
              }}
            />

            <DatePicker
              label="Check-out"
              value={checkOut ? dayjs(checkOut) : null}
              disabled={!checkIn}
              onChange={(value) => {
                setCheckOut(
                  value?.isValid()
                    ? value.format('YYYY-MM-DD')
                    : ''
                );
                setNotice(null);
              }}
              minDate={dayjs(minCheckout)}
              {...(maxCheckout
                ? { maxDate: dayjs(maxCheckout) }
                : {})}
              shouldDisableDate={(date) =>
                !stayIsFree(
                  checkIn,
                  date.format('YYYY-MM-DD')
                )
              }
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'medium',
                  placeholder: 'Select departure date',
                },
              }}
            />

            <TextField
              select
              fullWidth
              size="medium"
              label="Guests"
              value={guests}
              onChange={(event) =>
                setGuests(Number(event.target.value))
              }
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              {Array.from(
                { length: Math.min(place.capacity || 1, 10) },
                (_, index) => index + 1
              ).map((number) => (
                <MenuItem key={number} value={number}>
                  {plural(number, 'guest')}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Price and book button */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '1.8rem',
                    fontWeight: 700,
                    color: '#222222',
                  }}
                >
                  {money(place.pricePerNight)}
                </Typography>

                <Typography
                  sx={{ color: '#888888', fontSize: '0.85rem' }}
                >
                  /Night
                </Typography>
              </Box>

              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: '#999999',
                }}
              >
                Excluding taxes and fees.
              </Typography>
            </Box>

            <Button
              variant="contained"
              onClick={handleReserve}
              disabled={
                busy ||
                isOwner ||
                notice?.severity === 'success'
              }
              sx={{
                bgcolor: '#414958',
                color: '#FFFFFF',
                borderRadius: 0,
                px: 3,
                py: 1.2,
                minWidth: 125,
                textTransform: 'none',
                fontWeight: 500,
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#303744',
                  boxShadow: 'none',
                },
              }}
            >
              {busy ? 'Sending...' : 'Book Now'}
            </Button>
          </Box>

          {/* Price breakdown */}
          {nights > 0 && (
            <Box sx={{ mt: 2 }}>
              <Button
                onClick={() => setShowBreakdown((previous) => !previous)}
                sx={{
                  color: '#454545',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  p: 0,
                  minWidth: 0,
                }}
              >
                {showBreakdown
                  ? 'Hide price breakdown'
                  : 'View price breakdown'}
              </Button>

              <Collapse in={showBreakdown}>
                <Box
                  sx={{
                    mt: 2,
                    pt: 2,
                    borderTop: '1px solid #E5E5E5',
                    fontSize: '0.8rem',
                    color: '#555555',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <span>
                      {money(quote.nightlyRate)} × {plural(nights, 'night')}
                    </span>
                    <span>{money(quote.subtotal)}</span>
                  </Box>

                  {quote.cleaningFee > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <span>Cleaning fee</span>
                      <span>{money(quote.cleaningFee)}</span>
                    </Box>
                  )}

                  {quote.serviceFee > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <span>
                        Service fee ({quote.serviceFeePercent}%)
                      </span>
                      <span>{money(quote.serviceFee)}</span>
                    </Box>
                  )}

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #E5E5E5',
                      pt: 1.5,
                      mt: 1,
                      fontWeight: 700,
                    }}
                  >
                    <span>Total</span>
                    <span>{money(quote.total)}</span>
                  </Box>
                </Box>
              </Collapse>
            </Box>
          )}

          {isOwner && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This is your property, so you can't book it.
            </Alert>
          )}

          {notice && (
            <Alert severity={notice.severity} sx={{ mt: 2 }}>
              {notice.text}
            </Alert>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
}

export default function PropertyDetails({ place, open, onClose }) {
  if (!place) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby="place-title"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 0,
            bgcolor: '#FFFFFF',
            width: '100%',
            m: { xs: 1, sm: 2 },
             overflowY: 'auto',
        scrollbarWidth: 'none', // Firefox
        '&::-webkit-scrollbar': {
          display: 'none', // Chrome, Safari, Edge
          },
        },
        },
      }}
    >
      <Details
        key={place.id}
        place={place}
        onClose={onClose}
      />
    </Dialog>
  );
}
