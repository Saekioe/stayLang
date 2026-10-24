import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { usePlaces } from '../dataqueries/Data';
import PropertyDetails from './PropertyDetails';
import { urbanist } from '../font/Theme';

export function PlaceCard({ place, onSelect }) {
  if (!place) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          textAlign: 'left',
        }}
      >
        <Box sx={{ width: '100%', aspectRatio: '1.28', borderRadius: '12px', bgcolor: '#D9D9D9' }} />
      </Box>
    );
  }
  const mainImage = place.images?.[0] || place.image || '';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        textAlign: 'left',
      }}
    >
      <ButtonBase
        onClick={() => onSelect(place)}
        aria-label={`View ${place.name}`}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1.28',
          borderRadius: '12px',
          overflow: 'hidden',
          color: '#fff',
          bgcolor: '#D9D9D9',
          backgroundImage: mainImage ? `url("${mainImage}")` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'block',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.15)' }} />
      </ButtonBase>
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            color: '#111',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {place.name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.25,
          }}
        >
          <LocationOnIcon fontSize="small" />
          {place.city}
        </Typography>
      </Box>
    </Box>
  );
}

export function PlaceGrid({ items }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const handleSelect = (place) => {
    setSelected(place);
    setOpen(true);
  };

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 3,
          maxWidth: '100%',
          width: '100%',
          mx: 'auto',
          alignItems: 'stretch',
        }}
      >
        {items.map((place, i) => (
          <PlaceCard key={place?.id ?? `empty-${i}`} place={place} onSelect={handleSelect} />
        ))}
      </Box>

      <PropertyDetails place={selected} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function Places() {
  const navigate = useNavigate();
  const { places, error } = usePlaces();
  const items = Array.from({ length: 10 }, (_, i) => places[i] ?? null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#fff' }}>
      {/* Main Content Section */}
      <Box
        id="places"
        sx={{
          py: 6,
          px: { xs: 2, md: 4, lg: 6 },
          textAlign: 'center',
          flex: 1,
          width: '100%',
          maxWidth: 1600,
          mx: 'auto',
        }}
      >
        <Typography variant="h4" component="h2" sx={{ fontWeight: 700, color: '#000000', fontFamily: urbanist }}>
          Places for you
        </Typography>
        <Typography sx={{ maxWidth: 720, mx: 'auto', mt: 1, mb: 4 }}>
          Looking for your next place to relax? Explore some of our most popular
          accommodations, selected for their comfort, atmosphere, amenities, and
          unique design.
        </Typography>

        {error && (
          <Typography sx={{ color: 'error.main', mb: 2 }}>Couldn't load places.</Typography>
        )}
        <PlaceGrid items={items} />

        <Button
          variant="contained"
          onClick={() => navigate('/places')}
          sx={{ mt: 4, px: 4, borderRadius: '8px', boxShadow: '0 4px 10px rgba(69,123,145,.4)' }}
        >
          See More
        </Button>
      </Box>

      {/* Footer Section */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          bgcolor: '#213f30',
          color: '#ffffff',
          textAlign: 'center',
          borderTop: '1px solid #3F3636',
        }}
      >
        <Typography variant="body2" sx={{ fontFamily: urbanist, opacity: 0.8 }}>
          Staylang @ {new Date().getFullYear()} All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}