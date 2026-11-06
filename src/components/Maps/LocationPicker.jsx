
import { useState, useEffect, useMemo, useRef } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents
} from "react-leaflet";

// Leaflet stylesheet, marker images and map sizing
import "./leafletSetup";

// Default location: Manila
const DEFAULT_POSITION = {
  lat: 14.5995,
  lng: 120.9842
};

// Detect map clicks
function MapClickHandler({ onSelect }) {

  useMapEvents({
    click(event) {
      const position = {
        lat: event.latlng.lat,
        lng: event.latlng.lng
      };

      onSelect(position);
    }
  });

  return null;
}

// Moves the map to the pin when it was set from outside the map (address search)
// or the map was sized while hidden. Pins inside the current view are left alone.
function FollowPin({ position }) {
  const map = useMap();

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);

  const lat = position?.lat;
  const lng = position?.lng;
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
  }, [map, lat, lng]);

  return null;
}

export default function LocationPicker({
  onLocationSelect,
  initialPosition = null
}) {

  const [position, setPosition] = useState(initialPosition);

  const markerRef = useRef(null);

  // Update when editing an existing property
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition?.lat, initialPosition?.lng]);

  // Update parent component
  const updatePosition = (newPosition) => {
    setPosition(newPosition);
    onLocationSelect(newPosition);
  };

  // Marker drag event
  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;

      if (marker) {
        const newPosition = marker.getLatLng();

        updatePosition({
          lat: newPosition.lat,
          lng: newPosition.lng
        });
      }
    }
  }), [onLocationSelect]);

  return (
    <div className="map-wrapper">

      <MapContainer
        center={position
          ? [position.lat, position.lng]
          : [DEFAULT_POSITION.lat, DEFAULT_POSITION.lng]
        }
        zoom={13}
        scrollWheelZoom={true}
      >

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={updatePosition} />
        <FollowPin position={position} />

        {position && (
          <Marker
            position={[position.lat, position.lng]}
            draggable={true}
            eventHandlers={eventHandlers}
            ref={markerRef}
          >
            <Popup>
              Your property location
            </Popup>
          </Marker>
        )}

      </MapContainer>

      <div className="map-coordinates">

        {position ? (
          <>
            <span>
              Latitude: {position.lat.toFixed(6)}
            </span>

            <span>
              Longitude: {position.lng.toFixed(6)}
            </span>
          </>
        ) : (
          <span>
            Click anywhere on the map to pin your property.
          </span>
        )}

      </div>

    </div>
  );
}
