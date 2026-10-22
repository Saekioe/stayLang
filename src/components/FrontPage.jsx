import { Box, Typography, Button, Stack } from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';
import { labelFont, urbanist } from '../Theme';
import frontpage from '../assets/frontpage.png';
import subimage from '../images/subimage.png';

export default function FrontPage() {
  return (
    <Box sx={{ px: { xs: 1.5, md: 5.5 }, backgroundColor: '#ffffff', pt: { xs: 3, md: 10 } }}>
      <Box
        sx={{
          minHeight: { xs: 620, md: 850 },
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'left',
          color: '#fff',
          bgcolor: '#2D4A3A',
          backgroundImage:
            'linear-gradient(rgba(20,30,50,.5), rgba(20,30,50,.3)), url(' + frontpage + ')',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 5,
            width: '100%',
            px: { xs: 3, md: 10 },
            py: 6,
          }}
        >
          <Box sx={{ maxWidth: 520, textAlign: 'left', marginLeft: { xs: 0, md: 5 } }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, marginBottom: 0, paddingBottom: 0, fontfamily: urbanist }}>
              Where do you want to go?
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '2.75rem', md: '4rem' },
                fontWeight: 700,
                lineHeight: 1.05,
                my: 1.5,
              }}
            >
              Find Your Place to Unwind
            </Typography>
            <Typography sx={{ maxWidth: 470 }}>
              From peaceful cabins to stylish city apartments, find a stay that
              matches your vibe. Pack your bags, bring your favorite people, and
              let the good times begin.
            </Typography>
          </Box>

          <Box
            sx={{
              width: { xs: '100%', md: 350 },
              p: 2.25,
              borderRadius: '16px',
              bgcolor: 'rgba(255, 255, 255, 0.39)',
            }}
          >
            <Box
              component="img"
              src={subimage}
              alt="Guest relaxing by a resort pool"
              sx={{
                display: 'block',
                width: '100%',
                height: 250,
                objectFit: 'cover',
                borderRadius: '12px',
                bgcolor: 'rgba(255,255,255,.25)',
              }}
            />
            <Stack
              direction="row"
              sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 2 }}
            >
              <Button
                variant="contained"
                disableElevation
                href="#places"
                sx={{
                  bgcolor: '#FBF1C0',
                  color: '#3F3636',
                  borderRadius: 99,
                  px: 2.5,
                  py: 0.75,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  fontFamily: labelFont,
                  '&:hover': { bgcolor: '#F5E8A3' },
                }}
              >
                Book a stay
              </Button>
              <Button
                color="inherit"
                href="#places"
                startIcon={<ExploreIcon />}
                sx={{ lineHeight: 1.1, textAlign: 'left' }}
              >
                Discover our Places
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}