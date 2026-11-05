import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, LinearProgress, MenuItem, Rating, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getAuth } from 'firebase/auth';
import {
  collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { money } from '../../dataqueries/Booking';
import {
  DeleteButton, PageHeader, Panel, StatusPill, TextAction, colors, tableSx,
} from './adminUi';

const MIN_REVIEWS = 3; // below this, a rating is not reliable enough to judge a listing

// Today's date in Philippine time, as YYYY-MM-DD (same format as reservation.checkOut)
const todayPH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const HEALTH = {
  poor: { label: 'Poor – consider removal', color: 'error' },
  watch: { label: 'Watch', color: 'warning' },
  good: { label: 'Good', color: 'success' },
  low: { label: 'Not enough data', color: 'default' },
};

const VERIFY = {
  pending: { label: 'Awaiting review', color: 'warning' },
  approved: { label: 'Verified', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
};

// Listings created before verification existed count as verified
const verificationOf = (p) => p.verificationStatus || 'approved';

const REVIEW_CHECKLIST = [
  'Photos show a real place and match the description',
  'Address is complete and plausible for the city',
  'Proof document matches the host and the address',
  'Price, capacity and guest limits look reasonable',
  'Safety equipment and house rules are filled in',
];

const CAMERA_LABELS = {
  none: 'No security cameras',
  exterior: 'Outdoor cameras only',
  common: 'Cameras in shared indoor areas',
};

function buildStats(reviews = [], reservations = []) {
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count : 0;
  const dist = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const i = Math.round(Number(r.rating)) - 1;
    if (i >= 0 && i < 5) dist[i] += 1;
  });
  const lowCount = dist[0] + dist[1]; // 1-2 star reviews
  const today = todayPH();
  const total = reservations.length;
  const declined = reservations.filter((r) => r.status === 'declined').length;
  const hostCancelled = reservations.filter(
    (r) => r.status === 'cancelled' && r.cancelledBy === 'host',
  ).length;
  const guestCancelled = reservations.filter(
    (r) => r.status === 'cancelled' && r.cancelledBy === 'guest',
  ).length;
  const confirmed = reservations.filter((r) => r.status === 'confirmed').length;
  const upcoming = reservations.filter(
    (r) => ['pending', 'confirmed'].includes(r.status) && (r.checkOut || '') >= today,
  ).length;

  let health = 'good';
  const reliable = count >= MIN_REVIEWS;
  const badHostRate = total >= 3 && (declined + hostCancelled) / total >= 0.4;
  if (!reliable) health = 'low';
  else if (avg < 3) health = 'poor';
  else if (avg < 3.8 || lowCount / count >= 0.3) health = 'watch';
  if (badHostRate && health !== 'poor') health = 'watch';

  return {
    count, avg, dist, lowCount, total, declined, hostCancelled, guestCancelled, confirmed, upcoming,
    health,
  };
}

const EMPTY_STATS = buildStats([], []);

const fmtDate = (v) => {
  try {
    const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
    return d ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  } catch {
    return '';
  }
};

function HealthChip({ health }) {
  const h = HEALTH[health];
  return <Chip size="small" label={h.label} color={h.color} variant={health === 'low' ? 'outlined' : 'filled'} />;
}

function RatingCell({ stats }) {
  if (!stats.count) return <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>No reviews</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Rating value={stats.avg} precision={0.1} readOnly size="small" />
      <Typography sx={{ fontSize: 13 }}>
        {stats.avg.toFixed(1)} <span style={{ color: '#9CA3AF' }}>({stats.count})</span>
      </Typography>
    </Box>
  );
}

function Stat({ label, value, tone }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140, p: 2, borderRadius: '12px', border: '1px solid #E5E7EB', bgcolor: '#fff' }}>
      <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 600, color: tone || '#111827' }}>{value}</Typography>
    </Box>
  );
}

function Info({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );
}

// Everything the host submitted, plus the private proof document, for the admin to verify
function SubmissionDetails({ property: p }) {
  const [proof, setProof] = useState(undefined); // undefined = loading, null = none

  useEffect(() => {
    let live = true;
    getDoc(doc(db, 'propertyDocs', p.id))
      .then((s) => live && setProof(s.exists() ? s.data() : null))
      .catch(() => live && setProof(null));
    return () => { live = false; };
  }, [p.id]);

  const guests = [
    p.maxAdults != null && `${p.maxAdults} adults`,
    p.maxChildren != null && `${p.maxChildren} children`,
    p.maxInfants != null && `${p.maxInfants} infants`,
    p.petsAllowed ? `pets allowed (max ${p.maxPets ?? 1})` : 'no pets',
  ].filter(Boolean).join(', ');

  return (
    <>
      <Typography sx={{ fontWeight: 600, mb: 1 }}>Submitted details</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
        <Info label="Place type" value={[p.type, p.placeType].filter(Boolean).join(' · ')} />
        <Info label="Full address" value={p.location} />
        <Info label="Guests allowed (max)" value={guests} />
        <Info label="Check-in / out" value={p.checkInTime ? `${p.checkInTime} / ${p.checkOutTime}` : null} />
        <Info
          label="Smoking / events"
          value={p.smokingAllowed != null
            ? `${p.smokingAllowed ? 'Smoking OK' : 'No smoking'} · ${p.eventsAllowed ? 'Events OK' : 'No events'}`
            : null}
        />
        <Info label="Security cameras" value={CAMERA_LABELS[p.cameras]} />
        <Info label="Safety equipment" value={(p.safetyFeatures || []).join(', ') || 'None selected'} />
        <Info label="Cleaning fee" value={p.cleaningFee != null ? money(p.cleaningFee) : null} />
      </Box>
      {p.houseRules && <Info label="House rules" value={p.houseRules} />}

      {(p.images || []).length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 2 }}>
          {p.images.map((src, i) => (
            <Box
              key={i}
              component="img"
              src={src}
              alt={`Photo ${i + 1}`}
              sx={{ width: 120, height: 84, objectFit: 'cover', borderRadius: '8px', border: '1px solid #E5E7EB' }}
            />
          ))}
        </Box>
      )}

      <Typography sx={{ fontWeight: 600, mt: 1, mb: 0.5 }}>Proof document</Typography>
      {proof === undefined ? (
        <Typography sx={{ fontSize: 13, color: '#6B7280' }}>Loading…</Typography>
      ) : proof ? (
        <>
          <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1 }}>{proof.proofType}</Typography>
          <a href={proof.proofDoc} target="_blank" rel="noreferrer">
            <Box
              component="img"
              src={proof.proofDoc}
              alt="Proof document"
              sx={{ maxWidth: '100%', maxHeight: 280, borderRadius: '8px', border: '1px solid #E5E7EB' }}
            />
          </a>
        </>
      ) : (
        <Typography sx={{ fontSize: 13, color: '#B45309' }}>No proof document on file.</Typography>
      )}
    </>
  );
}

function PropertyDetailDialog({
  property, stats, reviews, onClose, onSetVisibility, onDelete, onDeleteReview, onApprove, onReject,
}) {
  const [owner, setOwner] = useState(null);
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    let live = true;
    setReason(property?.moderation?.reason || '');
    setChecks([]);
    if (property?.ownerId) {
      getDoc(doc(db, 'users', property.ownerId))
        .then((s) => live && setOwner(s.exists() ? s.data() : null))
        .catch(() => live && setOwner(null));
    }
    return () => { live = false; };
  }, [property]);

  if (!property) return null;
  const status = verificationOf(property);
  const allChecked = checks.length === REVIEW_CHECKLIST.length;
  const visible = property.published === true;
  const ownerName = owner?.fullName || owner?.displayName
    || [owner?.firstName, owner?.lastName].filter(Boolean).join(' ')
    || owner?.username || owner?.email || property.ownerId;
  const canDelete = stats.upcoming === 0;
  const sorted = [...reviews].sort((a, b) => (a.rating || 0) - (b.rating || 0));

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#111827', gap: 1 }}>
        {property.title}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip size="small" variant="outlined" color={VERIFY[status].color} label={VERIFY[status].label} />
          {status === 'approved' && <HealthChip health={stats.health} />}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Property info */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
          <Info label="Location" value={property.city} />
          <Info label="Nightly rate" value={money(property.pricePerNight)} />
          <Info label="Host" value={ownerName} />
          <Info label="Visibility" value={visible ? 'Visible to guests' : 'Hidden from guests'} />
          <Info label="Capacity" value={property.capacity ?? property.maxGuests} />
          <Info
            label="Bedrooms / Beds / Baths"
            value={[property.bedrooms, property.beds, property.baths].some((x) => x != null)
              ? `${property.bedrooms ?? '-'} / ${property.beds ?? '-'} / ${property.baths ?? '-'}` : null}
          />
          <Info label="Max nights" value={property.maxStay ?? property.maxNights} />
        </Box>
        {property.description && (
          <Typography sx={{ fontSize: 14, color: '#374151', mb: 2 }}>{property.description}</Typography>
        )}
        {property.moderation?.reason && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Last admin note ({fmtDate(property.moderation.at)}): {property.moderation.reason}
          </Alert>
        )}
        {status === 'rejected' && property.rejectionReason && (
          <Alert severity="error" sx={{ mb: 2 }}>Rejected: {property.rejectionReason}</Alert>
        )}

        <SubmissionDetails property={property} />

        {status === 'pending' && (
          <Box sx={{ mt: 2, p: 2, borderRadius: '10px', bgcolor: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Verification checklist</Typography>
            {REVIEW_CHECKLIST.map((item, i) => (
              <Box key={item}>
                <FormControlLabel
                  control={(
                    <Checkbox
                      size="small"
                      checked={checks.includes(i)}
                      onChange={() => setChecks((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}
                    />
                  )}
                  label={<Typography sx={{ fontSize: 14 }}>{item}</Typography>}
                />
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Ratings */}
        <Typography sx={{ fontWeight: 600, mb: 1 }}>Ratings</Typography>
        {stats.count === 0 ? (
          <Typography sx={{ fontSize: 14, color: '#6B7280' }}>No reviews yet.</Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>{stats.avg.toFixed(1)}</Typography>
              <Rating value={stats.avg} precision={0.1} readOnly size="small" />
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{stats.count} reviews</Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              {[5, 4, 3, 2, 1].map((star) => (
                <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12, width: 14 }}>{star}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(stats.dist[star - 1] / stats.count) * 100}
                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography sx={{ fontSize: 12, width: 24, textAlign: 'right' }}>{stats.dist[star - 1]}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Reservation signals */}
        <Typography sx={{ fontWeight: 600, mt: 2, mb: 1 }}>Reservation activity</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label={`Total: ${stats.total}`} />
          <Chip size="small" label={`Confirmed: ${stats.confirmed}`} />
          <Chip size="small" color={stats.declined ? 'warning' : 'default'} label={`Declined by host: ${stats.declined}`} />
          <Chip size="small" color={stats.hostCancelled ? 'warning' : 'default'} label={`Cancelled by host: ${stats.hostCancelled}`} />
          <Chip size="small" label={`Cancelled by guest: ${stats.guestCancelled}`} />
          <Chip size="small" color={stats.upcoming ? 'info' : 'default'} label={`Upcoming active: ${stats.upcoming}`} />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Reviews */}
        <Typography sx={{ fontWeight: 600, mb: 1 }}>Guest reviews (lowest first)</Typography>
        {sorted.length === 0 ? (
          <Typography sx={{ fontSize: 14, color: '#6B7280' }}>Nothing to show.</Typography>
        ) : sorted.map((r) => (
          <Box key={r.id} sx={{ display: 'flex', gap: 1, py: 1.25, borderBottom: '1px solid #F3F4F6' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Rating value={Number(r.rating) || 0} readOnly size="small" />
                <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>{fmtDate(r.createdAt)}</Typography>
              </Box>
              <Typography sx={{ fontSize: 14, mt: 0.5 }}>{r.text || <i>No written review</i>}</Typography>
              {r.hostReply && (
                <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.5, pl: 1.5, borderLeft: '2px solid #E5E7EB' }}>
                  Host reply: {r.hostReply}
                </Typography>
              )}
            </Box>
            <DeleteButton label="Delete review" onClick={() => onDeleteReview(r)} />
          </Box>
        ))}

        <Divider sx={{ my: 2 }} />

        {/* Moderation note */}
        <TextField
          label={status === 'pending'
            ? 'Reason (required to reject, shown to the host)'
            : 'Admin note / reason (saved on the property)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          size="small"
          multiline
          minRows={2}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Close</Button>
        <Box sx={{ flex: 1 }} />
        {status === 'pending' ? (
          <>
            <Button color="error" variant="outlined" disabled={!reason.trim()} onClick={() => onReject(property, reason)}>
              Reject
            </Button>
            <Button variant="contained" disabled={!allChecked} onClick={() => onApprove(property)}>
              Approve &amp; publish
            </Button>
          </>
        ) : (
          <>
            {status === 'approved' && (
              <Button
                variant="outlined"
                startIcon={visible ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                onClick={() => onSetVisibility(property, !visible, reason)}
              >
                {visible ? 'Hide from guests' : 'Publish'}
              </Button>
            )}
            <Tooltip title={canDelete ? '' : `${stats.upcoming} upcoming reservation(s). Hide the listing first and let them finish.`}>
              <span>
                <Button color="error" variant="contained" disabled={!canDelete} onClick={() => onDelete(property)}>
                  Delete permanently
                </Button>
              </span>
            </Tooltip>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function PropertyManagement() {
  const [properties, setProperties] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('worst');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'properties'),
        (snap) => setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setError('Failed to stream properties.')),
      onSnapshot(collection(db, 'reviews'),
        (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setError('Failed to stream reviews.')),
      onSnapshot(collection(db, 'reservations'),
        (snap) => setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setError('Failed to stream reservations.')),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Group reviews/reservations per property and compute health stats
  const { statsById, reviewsById } = useMemo(() => {
    const rv = {}; const rs = {};
    reviews.forEach((r) => { (rv[r.propertyId] ||= []).push(r); });
    reservations.forEach((r) => { (rs[r.propertyId] ||= []).push(r); });
    const stats = {};
    properties.forEach((p) => { stats[p.id] = buildStats(rv[p.id], rs[p.id]); });
    return { statsById: stats, reviewsById: rv };
  }, [properties, reviews, reservations]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = properties.filter((p) => {
      const s = statsById[p.id] || EMPTY_STATS;
      if (q && !`${p.title || ''} ${p.city || ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'visible') return p.published === true;
      if (filter === 'hidden') return p.published !== true;
      if (filter === 'pending') return verificationOf(p) === 'pending';
      if (filter === 'rejected') return verificationOf(p) === 'rejected';
      if (filter === 'attention') return s.health === 'poor' || s.health === 'watch';
      if (filter === 'poor') return s.health === 'poor';
      return true;
    });
    list = [...list].sort((a, b) => {
      // The review queue always stays on top
      const qa = verificationOf(a) === 'pending' ? 0 : 1;
      const qb = verificationOf(b) === 'pending' ? 0 : 1;
      if (qa !== qb) return qa - qb;

      const sa = statsById[a.id] || EMPTY_STATS; const sb = statsById[b.id] || EMPTY_STATS;
      if (sort === 'best') return sb.avg - sa.avg;
      if (sort === 'reviews') return sb.count - sa.count;
      if (sort === 'price') return (b.pricePerNight || 0) - (a.pricePerNight || 0);
      // 'worst': rated properties first, lowest average on top; unrated last
      const ra = sa.count ? sa.avg : 99; const rb = sb.count ? sb.avg : 99;
      return ra - rb;
    });
    return list;
  }, [properties, statsById, search, filter, sort]);

  const pendingCount = properties.filter((p) => verificationOf(p) === 'pending').length;
  const attention = properties.filter((p) => ['poor', 'watch'].includes((statsById[p.id] || EMPTY_STATS).health)).length;
  const visibleCount = properties.filter((p) => p.published === true).length;
  const selected = properties.find((p) => p.id === selectedId) || null;

  // Verification: approving publishes the listing, rejecting keeps it hidden with a reason
  const approveProperty = async (p) => {
    try {
      await updateDoc(doc(db, 'properties', p.id), {
        verificationStatus: 'approved',
        published: true,
        verifiedAt: serverTimestamp(),
        verifiedBy: getAuth().currentUser?.uid || null,
        rejectionReason: deleteField(),
      });
      setSelectedId(null);
      setSuccess(`"${p.title}" is verified and now live.`);
    } catch {
      setError('Could not approve this listing.');
    }
  };

  const rejectProperty = async (p, reason) => {
    try {
      await updateDoc(doc(db, 'properties', p.id), {
        verificationStatus: 'rejected',
        published: false,
        rejectionReason: reason.trim(),
        verifiedAt: serverTimestamp(),
        verifiedBy: getAuth().currentUser?.uid || null,
      });
      setSelectedId(null);
      setSuccess('Listing rejected. The host can see your reason and resubmit.');
    } catch {
      setError('Could not reject this listing.');
    }
  };

  // Guests only see listings where `published` is true (see usePlaces in Data.js),
  // so hiding or publishing a listing must change that same field.
  const setVisibility = async (p, next, reason = '') => {
    if (verificationOf(p) !== 'approved') {
      setError('Only verified listings can be published. Review it first.');
      return;
    }
    try {
      const payload = { published: next };
      if (!next) {
        payload.moderation = {
          action: 'hidden',
          reason: reason.trim(),
          by: getAuth().currentUser?.uid || null,
          at: serverTimestamp(),
        };
      } else {
        payload.moderation = deleteField();
      }
      await updateDoc(doc(db, 'properties', p.id), payload);
      setSuccess(next ? 'Listing is now visible to guests.' : 'Listing is now hidden from guests.');
    } catch {
      setError('Could not complete administrative action.');
    }
  };

  const handleDelete = async (p) => {
    const s = statsById[p.id] || EMPTY_STATS;
    if (s.upcoming > 0) {
      setError('This property has upcoming reservations. Hide it instead, or wait until they finish.');
      return;
    }
    if (!window.confirm(`Delete "${p.title}" permanently? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'properties', p.id));
      // Also remove the private proof document (ignore if there is none)
      deleteDoc(doc(db, 'propertyDocs', p.id)).catch(() => {});
      setSelectedId(null);
      setSuccess('Record removed successfully.');
    } catch {
      setError('Could not delete record.');
    }
  };

  const handleDeleteReview = async (r) => {
    if (!window.confirm('Delete this guest review permanently?')) return;
    try {
      await deleteDoc(doc(db, 'reviews', r.id));
      setSuccess('Review removed.');
    } catch {
      setError('Could not delete review.');
    }
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <PageHeader
        title="Property Management"
        subtitle="Verify new listings, review quality and guest feedback, then hide or remove poor properties."
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Stat label="Awaiting review" value={pendingCount} tone={pendingCount ? '#B45309' : undefined} />
        <Stat label="Total properties" value={properties.length} />
        <Stat label="Visible" value={visibleCount} />
        <Stat label="Hidden" value={properties.length - visibleCount} />
        <Stat label="Needs attention" value={attention} tone={attention ? '#B45309' : undefined} />
      </Box>

      <Panel
        title="All properties"
        subtitle="New submissions come first. Open a property to verify it or to see its reviews."
        footer={`Showing ${rows.length} of ${properties.length} properties · Nightly rates in PHP · Ratings need at least ${MIN_REVIEWS} reviews to be judged`}
      >
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', p: 2 }}>
          <TextField size="small" label="Search title or city" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <TextField select size="small" label="Filter" value={filter}
            onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="all">All properties</MenuItem>
            <MenuItem value="pending">Awaiting review</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="attention">Needs attention</MenuItem>
            <MenuItem value="poor">Poor (consider removal)</MenuItem>
            <MenuItem value="visible">Visible</MenuItem>
            <MenuItem value="hidden">Hidden</MenuItem>
          </TextField>
          <TextField select size="small" label="Sort by" value={sort}
            onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="worst">Lowest rated</MenuItem>
            <MenuItem value="best">Highest rated</MenuItem>
            <MenuItem value="reviews">Most reviews</MenuItem>
            <MenuItem value="price">Highest price</MenuItem>
          </TextField>
        </Box>

        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Property</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Nightly rate</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Verification</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Controls</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center">No properties found.</TableCell></TableRow>
              ) : (
                rows.map((p) => {
                  const visible = p.published === true;
                  const v = verificationOf(p);
                  const stats = statsById[p.id] || EMPTY_STATS;
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
                      <TableCell><RatingCell stats={stats} /></TableCell>
                      <TableCell>{v === 'approved' ? <HealthChip health={stats.health} /> : '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" color={VERIFY[v].color} label={VERIFY[v].label} />
                      </TableCell>
                      <TableCell>
                        <StatusPill label={visible ? 'Visible' : 'Hidden'} variant={visible ? 'visible' : 'hidden'} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextAction width={96} Icon={InfoOutlinedIcon} onClick={() => setSelectedId(p.id)}>
                            {v === 'pending' ? 'Review' : 'Details'}
                          </TextAction>
                          {v === 'approved' && (
                            <TextAction
                              width={96}
                              Icon={visible ? VisibilityOffOutlinedIcon : VisibilityOutlinedIcon}
                              onClick={() => setVisibility(p, !visible)}
                            >
                              {visible ? 'Hide' : 'Publish'}
                            </TextAction>
                          )}
                          <DeleteButton label={`Delete ${p.title}`} onClick={() => handleDelete(p)} />
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

      <PropertyDetailDialog
        property={selected}
        stats={selected ? statsById[selected.id] || EMPTY_STATS : EMPTY_STATS}
        reviews={selected ? reviewsById[selected.id] || [] : []}
        onClose={() => setSelectedId(null)}
        onSetVisibility={setVisibility}
        onDelete={handleDelete}
        onDeleteReview={handleDeleteReview}
        onApprove={approveProperty}
        onReject={rejectProperty}
      />
    </>
  );
}