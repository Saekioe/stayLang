import { useState } from 'react';
import { Box, InputAdornment, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NavigationBar from '../components/NavigationBar';
import { PlaceGrid } from '../components/Places';
import { usePlaces } from '../Data';

export default function FindPlaces() {
  const { places, error } = usePlaces();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const results = places.filter((p) => `${p.name} ${p.city}`.toLowerCase().includes(q));

  const padding = q ? 0 : Math.max(0, 5 - results.length);
  const items = [...results, ...Array.from({ length: padding }, () => null)];

  return (
    <>
      <NavigationBar />
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          px: 2,
          pt: 20,
          pb: 12,
          textAlign: 'center',
          backgroundColor: '#ffffff',
          minHeight: '100vh',
        }}
      >
        {/* Moon shape. Set `top` to your navbar height. */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: { xs: 56, md: 44 },
            left: 0,
            right: 0,
            height: { xs: 360, md: 300 },
            bgcolor: '#213f30',
            borderRadius: '0 0 50% 50% / 0 0 100% 100%',
            zIndex: 0,
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
            Find Places
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: '#ffffff' }}>
            Search by name or city
          </Typography>

          <TextField
            size="small"
            fullWidth
            placeholder="Search places"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ maxWidth: 420, mb: 10, bgcolor: '#fff', borderRadius: '8px' }}
            slotProps={{
              htmlInput: { 'aria-label': 'Search places by name or city' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {error ? (
            <Typography sx={{ color: '#ffd2cc' }}>Couldn't load places.</Typography>
          ) : q && results.length === 0 ? (
            <Typography sx={{ color: '#ffffff' }}>No places match "{query.trim()}".</Typography>
          ) : (
            <PlaceGrid items={items} />
          )}
        </Box>
      </Box>
    </>
  );
}