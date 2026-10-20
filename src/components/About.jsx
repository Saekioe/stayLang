import { useRef, useState } from 'react';
import { Box, Container, IconButton, Typography } from '@mui/material';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Empty cards. Fill in any field and it will show up on the card.
// Example: { id: 1, name: 'Hotel name', location: 'City, Country', score: '8.7',
//   reviews: '1,123', badge: 'Limited-time Deal', price: '2,456,000đ',
//   oldPrice: '2,756,000đ', image: '/images/hotel-1.jpg' }
const deals = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

const DARK_BLUE = '#1f4a9c';

function DealCard({ deal }) {
  const [liked, setLiked] = useState(false);

  return (
    <Box
      sx={{
        flex: '0 0 auto',
        width: { xs: 250, md: 'calc((100% - 72px) / 4)' },
        minWidth: 230,
        bgcolor: '#fff',
        borderRadius: '16px',
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        scrollSnapAlign: 'start',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '1.35',
          borderRadius: '12px',
          bgcolor: '#D9D9D9',
          backgroundImage: deal.image ? `url(${deal.image})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <IconButton
          aria-label={liked ? 'Remove from saved' : 'Save this stay'}
          onClick={() => setLiked((v) => !v)}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: '#fff',
            width: 28,
            height: 28,
            '&:hover': { bgcolor: '#f2f2f2' },
          }}
        >
          {liked ? (
            <FavoriteIcon sx={{ fontSize: 16, color: '#d32f2f' }} />
          ) : (
            <FavoriteBorderIcon sx={{ fontSize: 16, color: '#222' }} />
          )}
        </IconButton>
      </Box>

      <Box sx={{ px: 0.5, pt: 2, pb: 0.5, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {deal.name && (
          <Typography
            component="h3"
            sx={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25, color: '#1d1d1f', minHeight: 45 }}
          >
            {deal.name}
          </Typography>
        )}

        {deal.location && (
          <Typography sx={{ fontSize: 12, color: '#6b6b6b', mt: 0.5 }}>{deal.location}</Typography>
        )}

        {deal.score && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
            <Box
              sx={{
                bgcolor: DARK_BLUE,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                width: 26,
                height: 26,
                borderRadius: '6px 6px 6px 0',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {deal.score}
            </Box>
            {deal.reviews && (
              <Typography sx={{ fontSize: 11, lineHeight: 1.2, color: '#6b6b6b' }}>
                {deal.reviews} reviews
              </Typography>
            )}
          </Box>
        )}

        {deal.badge && (
          <Box
            sx={{
              alignSelf: 'flex-start',
              mt: 1.5,
              bgcolor: '#f9b920',
              color: '#1d1d1f',
              fontSize: 11,
              fontWeight: 600,
              px: 1.25,
              py: 0.5,
              borderRadius: '4px',
            }}
          >
            {deal.badge}
          </Box>
        )}

        {deal.price && (
          <Box sx={{ mt: 'auto', pt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#1d1d1f' }}>
                {deal.price}
              </Typography>
              {deal.oldPrice && (
                <Typography sx={{ fontSize: 11, color: '#8a8a8a', textDecoration: 'line-through' }}>
                  {deal.oldPrice}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function About() {
  const trackRef = useRef(null);

  const scrollByCard = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('div');
    const step = card ? card.offsetWidth + 24 : 300;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const arrowSx = {
    bgcolor: '#fff',
    color: '#1d1d1f',
    width: 40,
    height: 22,
    borderRadius: '11px',
    '&:hover': { bgcolor: '#eef2fa' },
  };

  return (
    <Container
      id="about"
      maxWidth={false}
      sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 4 }, backgroundColor: '#f7f8fc' }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          bgcolor: '#213f30',
          borderRadius: '12px',
          px: { xs: 2, md: 3 },
          py: { xs: 3, md: 4 },
          backgroundImage:
            'repeating-radial-gradient(ellipse at 20% 120%, rgba(255,255,255,0.05) 0 2px, transparent 2px 46px)',
        }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: '#fff',
            fontWeight: 200,
            fontSize: { xs: 24, md: 28 },
            textAlign: { xs: 'center', md: 'left' },
            ml: { xs: 0, md: 5 },
            mb: { xs: 1, md: 0 },
            mt: { xs: 0, md: 1 },
          }}
        >
          Deals for you
        </Typography>
        <Typography
          component="p"
          sx={{
            color: '#fff',
            fontSize: { xs: 14, md: 16 },
            ml: { xs: 0, md: 5 },
            mt: { xs: 1, md: 0 },
            pt: { xs: 0, md: 1 },
            textAlign: { xs: 'center', md: 'left' },
          }}
        >
          Check out these amazing deals on stays around the world. Whether you're looking for a
          relaxing getaway or an adventurous trip, we've got you covered with exclusive offers and
          discounts. Don't miss out on these limited-time opportunities to make your travel dreams
          come true!
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'center', md: 'flex-end' },
            mt: { xs: 1, md: -1 },
            mb: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton aria-label="Previous deals" onClick={() => scrollByCard(-1)} sx={arrowSx}>
              <ArrowBackIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton aria-label="Next deals" onClick={() => scrollByCard(1)} sx={arrowSx}>
              <ArrowForwardIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>

        <Box
          ref={trackRef}
          sx={{
            display: 'flex',
            gap: 3,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </Box>
      </Box>
    </Container>
  );
}