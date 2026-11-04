import { useEffect, useState } from 'react';
import {
  Alert, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { money } from '../../dataqueries/Booking';
import {
  DeleteButton, PageHeader, Panel, StatusPill, TextAction, colors, tableSx,
} from './adminUi';
 
export default function PropertyManagement() {
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
 
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setError('Failed to stream properties.'));
    return unsub;
  }, []);
 
  // Guests only see listings where `published` is true (see usePlaces in Data.js),
  // so hiding or publishing a listing must change that same field.
  const handleToggleVisibility = async (p) => {
    const next = p.published !== true;
    try {
      await updateDoc(doc(db, 'properties', p.id), { published: next });
      setSuccess(next ? 'Listing is now visible to guests.' : 'Listing is now hidden from guests.');
    } catch {
      setError('Could not complete administrative action.');
    }
  };
 
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record permanently?')) return;
    try {
      await deleteDoc(doc(db, 'properties', id));
      setSuccess('Record removed successfully.');
    } catch {
      setError('Could not delete record.');
    }
  };
 
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
 
      <PageHeader
        title="Property Management"
        subtitle="Manage property visibility, nightly rates and published listings."
      />
 
      <Panel
        title="All properties"
        subtitle="Control which properties are visible on StayLang"
        footer={`Showing all ${properties.length} properties · Nightly rates in PHP`}
      >
        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Property</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Nightly rate</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Controls</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {properties.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No properties found.</TableCell></TableRow>
              ) : (
                properties.map((p) => {
                  const visible = p.published === true;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32, height: 32, borderRadius: '8px', bgcolor: '#F2F5F7',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <HomeOutlinedIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                          </Box>
                          <Typography sx={{ fontSize: 14 }}>{p.title}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: `${colors.link} !important` }}>{p.city}</TableCell>
                      <TableCell>{money(p.pricePerNight)}</TableCell>
                      <TableCell>
                        <StatusPill label={visible ? 'Visible' : 'Hidden'} variant={visible ? 'visible' : 'hidden'} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextAction
                            width={96}
                            Icon={visible ? VisibilityOffOutlinedIcon : VisibilityOutlinedIcon}
                            onClick={() => handleToggleVisibility(p)}
                          >
                            {visible ? 'Hide' : 'Publish'}
                          </TextAction>
                          <DeleteButton label={`Delete ${p.title}`} onClick={() => handleDelete(p.id)} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </>
  );
}