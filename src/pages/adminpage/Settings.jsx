import { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { PageHeader, Panel, colors } from './adminUi';
 
export default function Settings() {
  const [categories, setCategories] = useState(['Apartment', 'Villa', 'Cabin', 'Loft', 'Beachhouse']);
  const [newCat, setNewCat] = useState('');
 
  const handleAddCategory = () => {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    setCategories([...categories, name]);
    setNewCat('');
  };
 
  return (
    <>
      <PageHeader
        title="Categories & Platform Settings"
        subtitle="Organize property categories available across StayLang."
      />
 
      <Panel title="Manage Property Categories" subtitle="Add and remove categories used to organize properties">
        <Box sx={{ px: 2.75, pb: 3 }}>
          <Typography sx={{ fontSize: 13, color: colors.muted, mb: 1 }}>Category name</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="New category name"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '99px', fontSize: 14, bgcolor: '#fff', height: 40 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.line },
              }}
            />
            <Button
              variant="contained"
              disableElevation
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
 
          <Typography sx={{ fontSize: 13, color: colors.muted, mb: 1 }}>Existing categories</Typography>
          <Box sx={{ border: `1px solid ${colors.line}`, borderRadius: '14px', overflow: 'hidden' }}>
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
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setCategories(categories.filter((item) => item !== c))}
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
    </>
  );
}