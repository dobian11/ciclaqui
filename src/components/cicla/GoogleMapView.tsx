import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { fetchPois, POI_META, type Poi, type PoiCategory } from "@/lib/pois";



export type TripMode = "foot" | "bike" | "car";

const MODE_COLORS: Record<TripMode, string> = {
  bike: "#00B86B",
  foot: "#E0B400",
  car: "#E84A3A",
};

const MODE_GLYPH: Record<TripMode, string> = {
  // Glifi semplificati: bici / persona / auto
  bike: "M5 17a3 3 0 1 0 .001 0M19 17a3 3 0 1 0 .001 0M12 17l-3-8h3l2 4h3l-1-3h2",
  foot: "M9 21l1-7-3-2 1-5 5 1 2 3 4 1-1 2-3-1-1 3 3 4-1 1-4-3-3 3z",
  car: "M5 16l2-6h10l2 6m-14 0v3m14-3v3M5 16h14",
};

function markerIconForMode(mode: TripMode) {
  const color = MODE_COLORS[mode];
  const d = MODE_GLYPH[mode];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="60" viewBox="0 0 46 60">
    <defs><filter id="s-${mode}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.28"/>
    </filter></defs>
    <g filter="url(#s-${mode})">
      <path d="M23 58 C 12 42 4 36 4 23 a19 19 0 1 1 38 0 c 0 13 -8 19 -19 35z" fill="${color}" stroke="white" stroke-width="2.5"/>
      <circle cx="23" cy="23" r="13" fill="white" opacity="0.18"/>
      <g transform="translate(11 11)" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="${d}"/>
      </g>
    </g>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(46, 60),
    anchor: new (window as any).google.maps.Point(23, 58),
  };
}

// Stile dark "Verde Cicla"
const DARK_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3a8" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a2a30" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c33" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0c0c0e" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#3a3a42" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#4a4a52" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a90" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a2a24" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a8a72" }] },
];

const DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 }; // Roma

export interface TripPathPoint {
  lat: number;
  lng: number;
}

export function GoogleMapView({
  position,
  mode,
  follow = true,
  path,
  poiCategories = [],
}: {
  position: [number, number] | null;
  mode: TripMode;
  follow?: boolean;
  path?: TripPathPoint[];
  poiCategories?: PoiCategory[];
}) {

  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const firstFix = useRef(true);
  const [error, setError] = useState<string | null>(null);

  // Init mappa
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: position ? { lat: position[0], lng: position[1] } : DEFAULT_CENTER,
          zoom: position ? 16 : 13,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: DARK_STYLE,
          backgroundColor: "#0c0c0e",
        });
        mapRef.current = map;
      })
      .catch((e) => setError(e?.message ?? "Errore caricamento mappa"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggiorna marker + camera quando la posizione cambia
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps || !position) return;
    const latLng = { lat: position[0], lng: position[1] };

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map,
        position: latLng,
        icon: markerIconForMode(mode),
        zIndex: 10,
      });
    } else {
      markerRef.current.setPosition(latLng);
      markerRef.current.setIcon(markerIconForMode(mode));
    }

    if (!accuracyRef.current) {
      accuracyRef.current = new google.maps.Circle({
        map,
        center: latLng,
        radius: 30,
        strokeColor: MODE_COLORS[mode],
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: MODE_COLORS[mode],
        fillOpacity: 0.12,
      });
    } else {
      accuracyRef.current.setCenter(latLng);
      accuracyRef.current.setOptions({
        strokeColor: MODE_COLORS[mode],
        fillColor: MODE_COLORS[mode],
      });
    }

    if (firstFix.current) {
      map.setCenter(latLng);
      map.setZoom(16);
      firstFix.current = false;
    } else if (follow) {
      map.panTo(latLng);
    }
  }, [position, mode, follow]);

  // Polyline del viaggio in corso
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    if (!path || path.length < 2) {
      if (polyRef.current) {
        polyRef.current.setMap(null);
        polyRef.current = null;
      }
      return;
    }

    if (!polyRef.current) {
      polyRef.current = new google.maps.Polyline({
        map,
        path,
        strokeColor: MODE_COLORS[mode],
        strokeOpacity: 0.9,
        strokeWeight: 5,
      });
    } else {
      polyRef.current.setPath(path);
      polyRef.current.setOptions({ strokeColor: MODE_COLORS[mode] });
    }
  }, [path, mode]);

  return (
    <>
      <div ref={ref} className="absolute inset-0 h-full w-full" />
      {error && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 px-6 text-center text-sm text-destructive">
          {error}
        </div>
      )}
    </>
  );
}
