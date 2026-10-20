import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { usePlaces } from '../Data';
import PropertyDetails from './PropertyDetails';
import { urbanist } from '../Theme';


export function PlaceCard({ place, onSelect }) {
  if (!place) {
    return <Box sx={{ aspectRatio: '1.28', borderRadius: '12px', bgcolor: '#D9D9D9' }} />;
  }
  return (
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
        backgroundImage: place.image ? `url("${place.image}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,.25)' }} />
      <Typography
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: '1.15rem',
          letterSpacing: 1,
        }}
      >
        <LocationOnIcon fontSize="small" />
        {place.city}
      </Typography>
    </ButtonBase>
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
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 1.5,
          maxWidth: 1000,
          mx: 'auto',
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
    <Box
      id="places"
      sx={{ bgcolor: '#fff', py: 6, px: 2, textAlign: 'center', borderBottom: '1px solid #3F3636', p: 10 }}
    >
      <Typography variant="h4" component="h2" sx={{ fontWeight: 700, color: '#000000', fontFalimy: urbanist }}>
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
  );
}