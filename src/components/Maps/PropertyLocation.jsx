import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import './leafletSetup';

// A map inside a dialog can be measured before it is visible; re-measure once it is shown.
function Resize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Read-only map for a listing page. Renders nothing when the listing has no pin.
export default function PropertyLocation({ lat, lng, title }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <div className="map-wrapper property-map">
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          {title && <Popup>{title}</Popup>}
        </Marker>
        <Resize />
      </MapContainer>
      <div className="map-coordinates">
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in OpenStreetMap
        </a>
      </div>
    </div>
  );
}
