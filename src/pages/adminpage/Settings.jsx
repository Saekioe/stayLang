import { useState } from 'react';
import { Box, Button, Chip, Paper, TextField, Typography } from '@mui/material';

export default function Settings() {
  const [categories, setCategories] = useState(['Apartment', 'Villa', 'Cabin', 'Loft', 'Beachhouse']);
  const [newCat, setNewCat] = useState('');

  const handleAddCategory = () => {
    if (!newCat.trim()) return;
    setCategories([...categories, newCat.trim()]);
    setNewCat('');
  };

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Categories & Platform Settings</Typography>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', maxWidth: 600 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Manage Property Categories</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="New category name"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <Button variant="contained" onClick={handleAddCategory}>Add</Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {categories.map((c) => (
            <Chip key={c} label={c} onDelete={() => setCategories(categories.filter((item) => item !== c))} />
          ))}
        </Box>
      </Paper>
    </>
  );
}