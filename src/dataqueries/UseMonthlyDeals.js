import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { money } from './Booking';
import { dealRate } from './Pricing';   

// Same seed gives the same random order, so everyone sees the same deals all month
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pinned deals first, then a seeded random pick from the rest
function pickDeals(all, count, seedKey) {
  const pinned = all.filter((d) => d.pinned);
  const rest = all
    .filter((d) => !d.pinned)
    .sort((a, b) => a.id.localeCompare(b.id)); // stable order before shuffle
  const rand = mulberry32(seedFrom(seedKey));
  return [...pinned, ...shuffle(rest, rand)].slice(0, count);
}

function toCard(d, ratings) {
  const p = d.property;
  const pct = Math.min(100, Math.max(0, Number(d.discountPercent) || 0));
  const base = Number(p.pricePerNight) || 0;
  // Same formula as the Firestore rule, so the rate always matches
    const dealPrice = pct ? dealRate(base, pct) : base;

  const card = {
    id: d.id,
    name: p.title,
    location: p.city,
    image: p.images?.[0],
    badge: d.badge || (pct ? `${pct}% off` : ''),
    price: base ? money(dealPrice) : '',
    oldPrice: pct && base ? money(base) : '',
    place: { ...p, name: p.title, dealPercent: pct, dealPrice },
  };
  if (ratings.length) {
    card.score = (ratings.reduce((s, x) => s + x, 0) / ratings.length).toFixed(1);
    card.reviews = String(ratings.length);
  }
  return card;
}

export default function useMonthlyDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [poolSnap, cfgSnap] = await Promise.all([
          getDocs(collection(db, 'deals')),
          getDoc(doc(db, 'settings', 'deals')),
        ]);
        const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
        const pool = poolSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => d.active !== false);

        const propSnaps = await Promise.all(
          pool.map((d) => getDoc(doc(db, 'properties', d.id)).catch(() => null)),
        );
        const live = pool
          .map((d, i) => (propSnaps[i]?.exists()
            ? { ...d, property: { id: propSnaps[i].id, ...propSnaps[i].data() } }
            : null))
          .filter((d) => d && d.property.published === true);

        const now = new Date();
        const seedKey = `${now.getFullYear()}-${now.getMonth() + 1}-${cfg.salt ?? 0}`;
        const picked = pickDeals(live, cfg.count ?? 4, seedKey);

        const ratings = {};
        const ids = picked.map((d) => d.id);
        if (ids.length) {
          try {
            const rs = await getDocs(
              query(collection(db, 'reviews'), where('propertyId', 'in', ids)),
            );
            rs.docs.forEach((r) => {
              const x = r.data();
              (ratings[x.propertyId] ||= []).push(Number(x.rating) || 0);
            });
          } catch {
            // ratings are optional
          }
        }
        setDeals(picked.map((d) => toCard(d, ratings[d.id] || [])));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { deals, loading };
}