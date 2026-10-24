import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NavigationBar from '../components/NavigationBar';
import { PlaceGrid } from '../components/Places';
import { usePlaces } from '../dataqueries/Data';

export default function FindPlaces() {
  const { places, error } = usePlaces();
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [minBedrooms, setMinBedrooms] = useState('all');
  const [minGuests, setMinGuests] = useState('all');

  const q = query.trim().toLowerCase();

  // Extract unique property types dynamically from places list
  const propertyTypes = ['all', ...new Set(places.map((p) => p.type).filter(Boolean))];

  const results = places.filter((p) => {
    const matchesQuery = `${p.name} ${p.city}`.toLowerCase().includes(q);
    const matchesPrice = !maxPrice || p.pricePerNight <= Number(maxPrice);
    const matchesType = propertyType === 'all' || p.type?.toLowerCase() === propertyType.toLowerCase();
    const matchesBedrooms = minBedrooms === 'all' || p.bedrooms >= Number(minBedrooms);
    const matchesGuests = minGuests === 'all' || (p.capacity && p.capacity >= Number(minGuests));

    return matchesQuery && matchesPrice && matchesType && matchesBedrooms && matchesGuests;
  });

  const handleClearFilters = () => {
    setQuery('');
    setMaxPrice('');
    setPropertyType('all');
    setMinBedrooms('all');
    setMinGuests('all');
  };

  const hasActiveFilters = q || maxPrice || propertyType !== 'all' || minBedrooms !== 'all' || minGuests !== 'all';
  const padding = hasActiveFilters ? 0 : Math.max(0, 5 - results.length);
  const items = [...results, ...Array.from({ length: padding }, () => null)];

  return (
    <>
      <NavigationBar />
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          px: { xs: 2, md: 4, lg: 6 },
          pt: 18,
          pb: 12,
          textAlign: 'center',
          backgroundColor: '#ffffff',
          minHeight: '100vh',
        }}
      >
        {/* Moon shape background */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: { xs: 56, md: 44 },
            left: 0,
            right: 0,
            height: { xs: 440, md: 300 },
            bgcolor: '#213f30',
            borderRadius: '0 0 50% 50% / 0 0 100% 100%',
            zIndex: 0,
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1600, mx: 'auto', width: '100%' }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#ffffff', mb: 1 }}>
            Find Places
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'rgba(255,255,255,0.8)' }}>
            Search by name, city, or filter by your preferences
          </Typography>

          {/* Search Bar */}
          <TextField
            size="small"
            fullWidth
            placeholder="Search places by name or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ maxWidth: 500, mb: 2, bgcolor: '#fff', borderRadius: '8px', mx: 'auto' }}
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

          {/* Filter Bar */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'rgba(255, 255, 255, 0)',
              p: 2,
              borderRadius: '12px',
              mb: 8,
              mt: 7,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1, color: '#213f30' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Filters:</Typography>
            </Box>

            {/* Max Price Filter */}
            <TextField
              size="small"
              type="number"
              placeholder="Budget"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              sx={{ width: 120, bgcolor: '#fff' }}
              slotProps={{ htmlInput: { min: 0 } }}
            />

            {/* Property Type Filter */}
            <FormControl size="small" sx={{ width: 130, bgcolor: '#fff' }}>
              <InputLabel id="type-label">Type</InputLabel>
              <Select
                labelId="type-label"
                value={propertyType}
                label="Type"
                onChange={(e) => setPropertyType(e.target.value)}
              >
                {propertyTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Minimum Bedrooms Filter */}
            <FormControl size="small" sx={{ width: 130, bgcolor: '#fff' }}>
              <InputLabel id="beds-label">Bedrooms</InputLabel>
              <Select
                labelId="beds-label"
                value={minBedrooms}
                label="Bedrooms"
                onChange={(e) => setMinBedrooms(e.target.value)}
              >
                <MenuItem value="all">Any</MenuItem>
                <MenuItem value={1}>1+ Beds</MenuItem>
                <MenuItem value={2}>2+ Beds</MenuItem>
                <MenuItem value={3}>3+ Beds</MenuItem>
                <MenuItem value={4}>4+ Beds</MenuItem>
              </Select>
            </FormControl>

            {/* Minimum Guests Filter */}
            <FormControl size="small" sx={{ width: 130, bgcolor: '#fff' }}>
              <InputLabel id="guests-label">Guests</InputLabel>
              <Select
                labelId="guests-label"
                value={minGuests}
                label="Guests"
                onChange={(e) => setMinGuests(e.target.value)}
              >
                <MenuItem value="all">Any</MenuItem>
                <MenuItem value={1}>1+ Guest</MenuItem>
                <MenuItem value={2}>2+ Guests</MenuItem>
                <MenuItem value={4}>4+ Guests</MenuItem>
                <MenuItem value={6}>6+ Guests</MenuItem>
              </Select>
            </FormControl>

            {/* Static Reset Button */}
            <Button
              size="small"
              variant="contained"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              sx={{
                bgcolor: '#fff',
                color: '#333',
                height: 40,
                px: 2,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#f5f5f5' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.6)', color: '#999' },
              }}
            >
              Reset
            </Button>
          </Box>

          {/* Results / Error View */}
          {error ? (
            <Typography sx={{ color: '#ffd2cc' }}>Couldn't load places.</Typography>
          ) : results.length === 0 ? (
            <Typography sx={{ color: '#ffffff', fontSize: '1.1rem', mt: 4 }}>
              No places match your search criteria.
            </Typography>
          ) : (
            <PlaceGrid items={items} />
          )}
        </Box>
      </Box>
    </>
  );
}