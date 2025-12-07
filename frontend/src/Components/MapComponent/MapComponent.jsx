import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Komponenta koja zumira mapu na odabranu državu
function ZoomHandler({ selectedLocation }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation && selectedLocation.geojson) {
      const layer = L.geoJSON(selectedLocation.geojson);
      // Animacija zumiranja na granice države
      map.fitBounds(layer.getBounds(), { padding: [50, 50], duration: 1 });
    }
  }, [selectedLocation, map]);
  return null;
}

const MapComponent = ({ locations, selectedId, onSelect }) => {
  
  // Stilovi za države
  const geoJsonStyle = (loc) => {
    const isSelected = loc._id === selectedId;
    return {
      fillColor: loc.color,
      weight: isSelected ? 3 : 1,     // Deblji rub ako je aktivna
      opacity: 1,
      color: isSelected ? '#fff' : 'white',
      dashArray: isSelected ? '' : '3', // Isprekidana linija ako nije aktivna
      fillOpacity: isSelected ? 0.7 : 0.4 
    };
  };

  const selectedLocation = locations.find(l => l._id === selectedId);

  return (
    <div className="map-wrapper">
      <MapContainer center={[48, 15]} zoom={4} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          // Koristimo CartoDB mapu jer je čista i boje se bolje vide
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap & CartoDB'
        />

        {locations.map(loc => (
          <GeoJSON 
            key={loc._id + (selectedId === loc._id ? '_active' : '')} // Trik za prisilni re-render stila
            data={loc.geojson}
            style={() => geoJsonStyle(loc)}
            eventHandlers={{
              click: () => onSelect(loc._id)
            }}
          />
        ))}

        <ZoomHandler selectedLocation={selectedLocation} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;