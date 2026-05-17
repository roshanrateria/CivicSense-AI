"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, MapPin } from "lucide-react";

// Default Leaflet icon fallback
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Create custom colored SVG pins
const createSvgIcon = (color: string) => L.divIcon({
  className: "bg-transparent border-none",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

export interface MapMarker {
  lat: number;
  lng: number;
  popup?: string;
  color?: string;
}

interface MapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  defaultLocation?: [number, number];
  readOnly?: boolean;
  markers?: MapMarker[];
}

function LocationMarker({ onSelect, position, readOnly }: { onSelect?: (lat: number, lng: number) => void, position: [number, number] | null, readOnly: boolean }) {
  const [pos, setPos] = useState<[number, number] | null>(position);
  const map = useMap();

  useEffect(() => {
    if (position && (position[0] !== pos?.[0] || position[1] !== pos?.[1])) {
      setPos(position);
      map.flyTo(position, 15, { animate: true, duration: 1 });
    }
  }, [position, map, pos]);

  useMapEvents({
    click(e) {
      if (readOnly) return;
      setPos([e.latlng.lat, e.latlng.lng]);
      if (onSelect) onSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return pos === null ? null : (
    <Marker position={pos} icon={icon} />
  );
}

export default function Map({ onLocationSelect, defaultLocation = [28.6139, 77.2090], readOnly = false, markers = [] }: MapProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setCurrentPos([lat, lon]);
        if (onLocationSelect) onLocationSelect(lat, lon);
      } else {
        alert("Location not found. Please try a different search term.");
      }
    } catch (err) {
      console.error("Search failed", err);
      alert("Failed to search location.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentPos([lat, lng]);
          if (onLocationSelect) onLocationSelect(lat, lng);
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get your current location. Please check browser permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {!readOnly && (
        <div className="absolute top-2 left-2 right-2 z-[1000] flex gap-2">
          <div className="flex-1 flex bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <input 
              type="text" 
              placeholder="Search location (e.g., Connaught Place)..." 
              className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-zinc-900 dark:text-zinc-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <button type="button" onClick={() => handleSearch()} disabled={isSearching} className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border-l border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
              <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </button>
          </div>
          <button 
            onClick={handleCurrentLocation}
            type="button"
            className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center text-blue-600 dark:text-blue-500"
            title="Use current location"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="flex-1 w-full relative z-0">
        <MapContainer 
          center={defaultLocation} 
          zoom={12} 
          scrollWheelZoom={true} 
          style={{ height: "100%", width: "100%", zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <LocationMarker onSelect={onLocationSelect} position={currentPos} readOnly={readOnly} />}
          {markers.map((marker, idx) => (
            <Marker key={idx} position={[marker.lat, marker.lng]} icon={marker.color ? createSvgIcon(marker.color) : icon}>
              {marker.popup && (
                <Popup>
                  <div dangerouslySetInnerHTML={{ __html: marker.popup }} />
                </Popup>
              )}
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
