// Turns a Philippine address into map coordinates with OpenStreetMap's free Nominatim search.
// Usage policy: one request per second at most, and only when the person asks (button click).
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(query) {
  const url = `${ENDPOINT}?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocode-failed');
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) return null;
  const lat = Number(list[0].lat);
  const lng = Number(list[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// `parts` = { street, barangay, city, province, postalCode }.
// Street-level matches are rare, so we fall back to coarser queries: barangay, then city.
export async function geocodeAddress({ street = '', barangay = '', city = '', province = '', postalCode = '' }) {
  const join = (...items) => items.map((s) => s.trim()).filter(Boolean).join(', ');
  const attempts = [
    join(street, barangay, city, province, postalCode),
    join(barangay, city, province),
    join(city, province),
  ].filter((q, i, all) => q && all.indexOf(q) === i);

  for (let i = 0; i < attempts.length; i += 1) {
    if (i > 0) await wait(1100);
    const hit = await search(attempts[i]);
    if (hit) return { ...hit, precise: i === 0 };
  }
  return null;
}
