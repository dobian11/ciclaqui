import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

export type TripMode = "foot" | "bike" | "car";

const MODE_COLORS: Record<TripMode, string> = {
  bike: "#00B86B",
  foot: "#E0B400",
  car: "#E84A3A",
};

const MODE_PATH: Record<TripMode, string> = {
  // Simplified bike, person, car silhouettes (white strokes on color)
  bike: "M5 17a3 3 0 1 1 0-.001M19 17a3 3 0 1 1 0-.001M12 17l-3-8h3l2 4h3l-1-3h2",
  foot: "M9 21l1-7-3-2 1-5 5 1 2 3 4 1-1 2-3-1-1 3 3 4-1 1-4-3-3 3z",
  car: "M5 16l2-6h10l2 6m-14 0v3m14-3v3M5 16h14",
};

function createModeIcon(mode: TripMode) {
  const color = MODE_COLORS[mode];
  const d = MODE_PATH[mode];
  const svg = `
    <svg width="46" height="60" viewBox="0 0 46 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${mode}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g filter="url(#shadow-${mode})">
        <path d="M23 58 C 12 42 4 36 4 23 a19 19 0 1 1 38 0 c 0 13 -8 19 -19 35z" fill="${color}" stroke="white" stroke-width="2.5"/>
        <circle cx="23" cy="23" r="13" fill="white" opacity="0.18"/>
        <g transform="translate(11 11) scale(1)" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="${d}"/>
        </g>
      </g>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "cicla-mode-marker",
    iconSize: [46, 60],
    iconAnchor: [23, 58],
    popupAnchor: [0, -50],
  });
}

function LocationLayer({
  position,
  mode,
  follow,
}: {
  position: [number, number] | null;
  mode: TripMode;
  follow: boolean;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const firstFix = useRef(true);

  useEffect(() => {
    if (!position) return;
    if (!markerRef.current) {
      markerRef.current = L.marker(position, {
        icon: createModeIcon(mode),
        keyboard: false,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
      markerRef.current.setIcon(createModeIcon(mode));
    }
    if (!accuracyRef.current) {
      accuracyRef.current = L.circle(position, {
        radius: 30,
        color: MODE_COLORS[mode],
        weight: 1,
        fillColor: MODE_COLORS[mode],
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      accuracyRef.current.setLatLng(position);
      accuracyRef.current.setStyle({
        color: MODE_COLORS[mode],
        fillColor: MODE_COLORS[mode],
      });
    }
    if (firstFix.current || follow) {
      map.setView(position, firstFix.current ? 16 : map.getZoom(), { animate: !firstFix.current });
      firstFix.current = false;
    }
  }, [position, mode, follow, map]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (accuracyRef.current) {
        accuracyRef.current.remove();
        accuracyRef.current = null;
      }
    };
  }, []);

  return null;
}

const DEFAULT_CENTER: [number, number] = [41.9028, 12.4964]; // Roma

export function MapView({
  position,
  mode,
  follow = true,
}: {
  position: [number, number] | null;
  mode: TripMode;
  follow?: boolean;
}) {
  // Avoid SSR issues — we already ssr:false on the route, but defensive
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <MapContainer
      center={position ?? DEFAULT_CENTER}
      zoom={position ? 16 : 13}
      zoomControl={false}
      attributionControl={false}
      className="absolute inset-0 h-full w-full"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
        subdomains={["a", "b", "c", "d"]}
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <LocationLayer position={position} mode={mode} follow={follow} />
    </MapContainer>
  );
}
