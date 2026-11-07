import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  collection, deleteDoc, doc, increment, onSnapshot, setDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { money } from '../../dataqueries/Booking';
import { PageHeader, Panel, tableSx } from './adminUi';

const verificationOf = (p) => p.verificationStatus || 'approved';

function DealRow({ property: p, deal, onToggle, onSave }) {
  const [pct, setPct] = useState(deal?.discountPercent ?? '');
  const [badge, setBadge] = useState(deal?.badge ?? '');
  const on = !!deal;

  useEffect(() => {
    setPct(deal?.discountPercent ?? '');
    setBadge(deal?.badge ?? '');
  }, [deal]);

  return (
    <TableRow>
      <TableCell>{p.title}</TableCell>
      <TableCell>{p.city}</TableCell>
      <TableCell>{money(p.pricePerNight)}</TableCell>
      <TableCell>
        <Switch checked={on} onChange={() => onToggle(p, on)} />
      </TableCell>
      <TableCell>
        <TextField
          size="small" type="number" disabled={!on} sx={{ width: 90 }}
          value={pct} onChange={(e) => setPct(e.target.value)}
          onBlur={() => on && onSave(p, { discountPercent: Number(pct) || 0 })}
        />
      </TableCell>
      <TableCell>
        <TextField
          size="small" disabled={!on} sx={{ width: 170 }}
          value={badge} onChange={(e) => setBadge(e.target.value)}
          onBlur={() => on && onSave(p, { badge: badge.trim() })}
        />
      </TableCell>
      <TableCell>
        <Switch
          disabled={!on} checked={!!deal?.pinned}
          onChange={() => onSave(p, { pinned: !deal?.pinned })}
        />
      </TableCell>
    </TableRow>
  );
}

export default function DealsManagement() {
  const [properties, setProperties] = useState([]);
  const [deals, setDeals] = useState({});
  const [count, setCount] = useState(4);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'properties'),
        (snap) => setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setError('Failed to load properties.')),
      onSnapshot(collection(db, 'deals'),
        (snap) => {
          const map = {};
          snap.docs.forEach((d) => { map[d.id] = d.data(); });
          setDeals(map);
        },
        () => setError('Failed to load deals.')),
      onSnapshot(doc(db, 'settings', 'deals'),
        (s) => s.exists() && s.data().count && setCount(s.data().count)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Only verified and visible properties can be deals
  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => verificationOf(p) === 'approved'
      && p.published === true
      && (!q || `${p.title || ''} ${p.city || ''}`.toLowerCase().includes(q)));
  }, [properties, search]);

  const toggle = async (p, isOn) => {
    try {
      if (isOn) await deleteDoc(doc(db, 'deals', p.id));
      else await setDoc(doc(db, 'deals', p.id), { active: true, pinned: false, discountPercent: 0, badge: '' });
    } catch {
      setError('Could not update deals.');
    }
  };

  const save = async (p, fields) => {
    try {
      await setDoc(doc(db, 'deals', p.id), fields, { merge: true });
    } catch {
      setError('Could not save changes.');
    }
  };

  const saveCount = async () => {
    try {
      await setDoc(doc(db, 'settings', 'deals'), { count: Number(count) || 4 }, { merge: true });
      setSuccess('Saved.');
    } catch {
      setError('Could not save.');
    }
  };

  const reroll = async () => {
    try {
      await setDoc(doc(db, 'settings', 'deals'), { salt: increment(1) }, { merge: true });
      setSuccess('Deals re-rolled for this month.');
    } catch {
      setError('Could not re-roll.');
    }
  };

  const poolSize = Object.keys(deals).length;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <PageHeader
        title="Deals"
        subtitle="Pick properties for the deals pool. The site shows a random set from this pool each month."
      />

      <Panel
        title="Available properties"
        subtitle="Only verified and visible properties are listed."
        footer={`${poolSize} in pool · Pinned deals always show first`}
      >
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', p: 2, alignItems: 'center' }}>
          <TextField size="small" label="Search title or city" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <TextField size="small" type="number" label="Deals to show" value={count}
            onChange={(e) => setCount(e.target.value)} sx={{ width: 140 }} />
          <Button variant="outlined" onClick={saveCount}>Save</Button>
          <Button variant="outlined" onClick={reroll}>Re-roll this month</Button>
        </Box>

        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Property</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Nightly rate</TableCell>
                <TableCell>In pool</TableCell>
                <TableCell>Discount %</TableCell>
                <TableCell>Badge</TableCell>
                <TableCell>Pinned</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {available.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography sx={{ fontSize: 14 }}>No properties found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                available.map((p) => (
                  <DealRow key={p.id} property={p} deal={deals[p.id]} onToggle={toggle} onSave={save} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </>
  );
}