import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import KitchenIcon from '@mui/icons-material/Kitchen';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import PetsIcon from '@mui/icons-material/Pets';
import PoolIcon from '@mui/icons-material/Pool';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TvIcon from '@mui/icons-material/Tv';
import WifiIcon from '@mui/icons-material/Wifi';
import { db } from '../firebase/firebase';

// Hosts pick from these. Firestore stores only the `key`.
export const amenityOptions = [
  { key: 'wifi', label: 'Wifi', Icon: WifiIcon },
  { key: 'pool', label: 'Pool', Icon: PoolIcon },
  { key: 'parking', label: 'Parking', Icon: LocalParkingIcon },
  { key: 'restaurant', label: 'Restaurant', Icon: RestaurantIcon },
  { key: 'gym', label: 'Gym', Icon: FitnessCenterIcon },
  { key: 'ac', label: 'Air conditioning', Icon: AcUnitIcon },
  { key: 'kitchen', label: 'Kitchen', Icon: KitchenIcon },
  { key: 'tv', label: 'TV', Icon: TvIcon },
  { key: 'laundry', label: 'Laundry', Icon: LocalLaundryServiceIcon },
  { key: 'pets', label: 'Pets allowed', Icon: PetsIcon },
];

// Used until the admin saves a category list (Admin > Settings > settings/categories).
export const DEFAULT_PROPERTY_TYPES = [
  'Hotel', 'Luxury Hotel', 'Apartment', 'Condo', 'House', 'Villa', 'Cabin', 'Resort',
];
export const propertyTypes = DEFAULT_PROPERTY_TYPES;

// The categories the admin manages, updating live. Falls back to the default list.
export function usePropertyTypes() {
  const [types, setTypes] = useState(DEFAULT_PROPERTY_TYPES);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'categories'),
        (snap) => {
          const items = snap.exists() && Array.isArray(snap.data().items)
            ? snap.data().items.filter((t) => typeof t === 'string' && t.trim())
            : [];
          setTypes(items.length ? items : DEFAULT_PROPERTY_TYPES);
        },
        () => {}
      ),
    []
  );

  return types;
}

const amenityByKey = Object.fromEntries(amenityOptions.map((a) => [a.key, a]));

// Firestore listing -> the shape the cards and the info modal use.
export function toPlace(snap) {
  const d = snap.data();
  return {
    id: snap.id,
    ownerId: d.ownerId,
    name: d.title,
    city: d.city,
    location: d.location,
    lat: Number.isFinite(d.lat) ? d.lat : null,
    lng: Number.isFinite(d.lng) ? d.lng : null,
    type: d.type,
    image: d.images?.[0] ?? '',
    images: d.images ?? [],
    host: d.hostName,
    hostBio: d.hostBio ?? '',
    hostEmail: d.hostEmail ?? '',
    hostPhone: d.hostPhone ?? '',
    rating: d.rating ?? null,
    pricePerNight: d.pricePerNight,
    maxStay: d.maxStay ?? null,
    cleaningFee: d.cleaningFee ?? 0,
    capacity: d.capacity ?? 1,
    placeType: d.placeType ?? '',
    // Guest limits set by the host (the booking panel falls back to `capacity` for older listings)
    maxAdults: d.maxAdults ?? null,
    maxChildren: d.maxChildren ?? null,
    maxInfants: d.maxInfants ?? 0,
    petsAllowed: Boolean(d.petsAllowed),
    maxPets: d.maxPets ?? 0,
    // House rules
    checkInTime: d.checkInTime ?? '',
    checkOutTime: d.checkOutTime ?? '',
    houseRules: d.houseRules ?? '',
    smokingAllowed: Boolean(d.smokingAllowed),
    eventsAllowed: Boolean(d.eventsAllowed),
    cameras: d.cameras ?? 'none',
    safetyFeatures: d.safetyFeatures ?? [],
    bedrooms: d.bedrooms ?? 0,
    beds: d.beds ?? 1,
    baths: d.baths ?? 0,
    description: d.description,
    amenities: (d.amenities ?? []).map((k) => amenityByKey[k]).filter(Boolean),
    reviews: d.reviews ?? [],
    createdAt: d.createdAt?.seconds ?? 0,
  };
}

// All published listings, updating live.
export function usePlaces() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'properties'), where('published', '==', true));
    return onSnapshot(
      q,
      (snap) => {
        setPlaces(snap.docs.map(toPlace).sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, []);

  return { places, loading, error };
}

// Messages for one user (newest first), updating live.
export function useNotifications(uid) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    const q = query(collection(db, 'notifications'), where('userId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setItems(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, [uid]);

  const list = uid ? items : [];
  return {
    items: list,
    loading: uid ? loading : false,
    error: uid ? error : null,
    unread: list.filter((n) => !n.read).length,
  };
}

// Reviews for one property (newest first), updating live.
export function usePropertyReviews(propertyId) {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!propertyId) return undefined;
    const q = query(collection(db, 'reviews'), where('propertyId', '==', propertyId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        // Reviews the admin hid are not shown to guests (the rules still let anyone read them)
        setReviews(list.filter((r) => !r.hidden));
      },
      () => setReviews([])
    );
  }, [propertyId]);

  return propertyId ? reviews : [];
}