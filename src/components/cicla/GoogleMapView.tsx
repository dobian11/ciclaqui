import { memo, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { fetchPois, getKnownPois, POI_META, type Poi, type PoiCategory } from "@/lib/pois";



export type TripMode = "foot" | "bike" | "car";

const MODE_COLORS: Record<TripMode, string> = {
  bike: "#00B86B",
  foot: "#E0B400",
  car: "#E84A3A",
};

const MODE_EMOJI: Record<TripMode, string> = {
  bike: "🚴",
  foot: "🚶",
  car: "🚗",
};

// Cache delle icone SVG: evita di rigenerare data-URL ad ogni fix GPS
// (il GC delle stringhe pesava su dispositivi low-end e causava micro-stutter).
const PIN_ICON_CACHE: Record<string, any> = {};
const ARROW_ICON_CACHE: Record<string, any> = {};

function pinIconForMode(mode: TripMode) {
  const cached = PIN_ICON_CACHE[mode];
  if (cached) return cached;
  const color = MODE_COLORS[mode];
  const emoji = MODE_EMOJI[mode];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="66" viewBox="0 0 52 66">
    <defs><filter id="s-${mode}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.8" flood-color="#000" flood-opacity="0.32"/>
    </filter></defs>
    <g filter="url(#s-${mode})">
      <path d="M26 64 C 13 46 4 39 4 24 a22 22 0 1 1 44 0 c 0 15 -9 22 -22 40z" fill="${color}" stroke="white" stroke-width="3"/>
      <circle cx="26" cy="24" r="15" fill="white"/>
      <text x="26" y="30" text-anchor="middle" font-size="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI Emoji', 'Apple Color Emoji', system-ui">${emoji}</text>
    </g>
  </svg>`;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(52, 66),
    anchor: new (window as any).google.maps.Point(26, 64),
  };
  PIN_ICON_CACHE[mode] = icon;
  return icon;
}

function arrowIconForMode(mode: TripMode, heading: number) {
  // Quantizza l'heading a 5° → al massimo 72 varianti per modalità, cache-friendly
  const h = Math.round(heading / 5) * 5;
  const key = `${mode}-${h}`;
  const cached = ARROW_ICON_CACHE[key];
  if (cached) return cached;
  const color = MODE_COLORS[mode];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <defs><filter id="as-${mode}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
    </filter></defs>
    <g filter="url(#as-${mode})">
      <circle cx="28" cy="28" r="13" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-opacity="0.5" stroke-width="1"/>
      <g transform="rotate(${h} 28 28)">
        <path d="M28 8 L42 38 L28 31 L14 38 Z" fill="${color}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="28" cy="31" r="3" fill="white"/>
      </g>
    </g>
  </svg>`;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(56, 56),
    anchor: new (window as any).google.maps.Point(28, 28),
  };
  ARROW_ICON_CACHE[key] = icon;
  return icon;
}


function computeBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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

function GoogleMapViewImpl({
  position,
  mode,
  follow = true,
  path,
  poiCategories = [],
  refreshKey = 0,
  onRefreshError,
  onRefreshComplete,
  onPoiLoadingChange,
  onPoiSelect,
  selectedPoiId,
  routePath,
  focusPoi,
  interactionsLocked = false,
}: {
  position: [number, number] | null;
  mode: TripMode;
  follow?: boolean;
  path?: TripPathPoint[];
  poiCategories?: PoiCategory[];
  refreshKey?: number;
  onRefreshError?: (message: string) => void;
  onRefreshComplete?: (result: { ok: boolean; error?: string; count?: number }) => void;
  onPoiLoadingChange?: (loading: boolean) => void;
  onPoiSelect?: (poi: Poi) => void;
  selectedPoiId?: string | null;
  routePath?: TripPathPoint[] | null;
  /** Destinazione scelta dalla ricerca testuale: marker + centratura mappa. */
  focusPoi?: Poi | null;
  /** Disabilita temporaneamente pan e zoom, ad esempio durante la ricerca con tastiera aperta. */
  interactionsLocked?: boolean;
}) {


  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const lastIconUrlRef = useRef<string | null>(null);
  const accuracyRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const routePolyRef = useRef<any>(null);
  const poiMarkersRef = useRef<Map<string, { marker: any; poi: Poi }>>(new Map());
  const poiAbortRef = useRef<AbortController | null>(null);
  const poiDebounceRef = useRef<number | null>(null);
  const firstFix = useRef(true);
  const focusMarkerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  // La mappa viene creata in modo asincrono: senza questo contatore gli effetti
  // che dipendono da `mapRef.current` non venivano mai rieseguiti dopo il load
  // (POI e layer restavano invisibili se attivati prima del caricamento).
  const [mapReady, setMapReady] = useState(0);



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
          // Manteniamo l'interfaccia essenziale, ma lasciamo disponibile Pegman:
          // con disableDefaultUI senza questa opzione Street View spariva del tutto.
          streetViewControl: true,
          streetViewControlOptions: {
            position: google.maps.ControlPosition.LEFT_CENTER,
          },
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: DARK_STYLE,
          backgroundColor: "#0c0c0e",
        });
        mapRef.current = map;
        setMapReady((n) => n + 1);
      })
      .catch((e) => setError(e?.message ?? "Errore caricamento mappa"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Evita spostamenti involontari della mappa mentre l'utente scrive nella ricerca.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setOptions({
      draggable: !interactionsLocked,
      gestureHandling: interactionsLocked ? "none" : "greedy",
      scrollwheel: !interactionsLocked,
      disableDoubleClickZoom: interactionsLocked,
      keyboardShortcuts: !interactionsLocked,
    });
  }, [interactionsLocked, mapReady]);

  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);

  // Aggiorna marker + camera quando la posizione cambia (con animazione fluida)
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps || !position) return;
    const latLng = { lat: position[0], lng: position[1] };

    const prev = prevPosRef.current;
    const distance = prev ? haversineMeters(prev, latLng) : 0;
    // Soglia per considerare l'utente "in movimento" — sotto i 2m è rumore GPS.
    const moving = distance > 2;
    if (moving && prev) {
      const newH = computeBearing(prev, latLng);
      const curH = headingRef.current;
      if (curH == null) headingRef.current = newH;
      else {
        const delta = ((newH - curH + 540) % 360) - 180;
        headingRef.current = (curH + delta * 0.5 + 360) % 360;
      }
    }

    const icon =
      moving && headingRef.current != null
        ? arrowIconForMode(mode, headingRef.current)
        : pinIconForMode(mode);

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map,
        position: latLng,
        icon,
        zIndex: 10,
        optimized: false,
      });
      lastIconUrlRef.current = icon.url;
    } else {
      // setIcon è costoso: chiamalo solo se l'icona è effettivamente cambiata
      if (icon.url !== lastIconUrlRef.current) {
        markerRef.current.setIcon(icon);
        lastIconUrlRef.current = icon.url;
      }
      // Anima la posizione dal punto precedente al nuovo per un movimento fluido
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const start = markerRef.current.getPosition();
      const startLat = start?.lat() ?? latLng.lat;
      const startLng = start?.lng() ?? latLng.lng;
      const duration = 800;
      const t0 = performance.now();
      const stepAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / duration);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const lat = startLat + (latLng.lat - startLat) * ease;
        const lng = startLng + (latLng.lng - startLng) * ease;
        markerRef.current.setPosition({ lat, lng });
        if (accuracyRef.current) accuracyRef.current.setCenter({ lat, lng });
        if (k < 1) animRef.current = requestAnimationFrame(stepAnim);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(stepAnim);
    }

    prevPosRef.current = latLng;

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
  }, [position, mode, follow, mapReady]);

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
  }, [path, mode, mapReady]);

  // POI layers: fetch when categories change OR after the map stops panning, debounced.
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    const clearAll = () => {
      poiMarkersRef.current.forEach((entry) => entry.marker.setMap(null));
      poiMarkersRef.current.clear();
    };

    if (poiCategories.length === 0) {
      clearAll();
      return;
    }

    const poiIcon = (cat: PoiCategory, selected = false) => {
      const meta = POI_META[cat];
      const scale = selected ? 1.25 : 1;
      const w = Math.round(32 * scale);
      const h = Math.round(40 * scale);
      const ring = selected
        ? `<circle cx="16" cy="15" r="14" fill="none" stroke="white" stroke-width="2" stroke-opacity="0.9"/>`
        : "";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 40">
        <defs><filter id="ps-${cat}-${selected ? "on" : "off"}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity="0.3"/>
        </filter></defs>
        <g filter="url(#ps-${cat}-${selected ? "on" : "off"})">
          <path d="M16 38 C8 28 3 24 3 15 a13 13 0 1 1 26 0 c0 9 -5 13 -13 23z" fill="${meta.color}" stroke="white" stroke-width="2"/>
          <circle cx="16" cy="15" r="8.5" fill="white"/>
          <text x="16" y="19" text-anchor="middle" font-size="11" font-family="system-ui">${meta.emoji}</text>
          ${ring}
        </g>
      </svg>`;
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(w, h),
        anchor: new google.maps.Point(Math.round(w / 2), h),
      };
    };

    // I marker restano sulla mappa: aggiungiamo i nuovi e rimuoviamo solo
    // quelli di categorie non più attive (prima sparivano a ogni refetch).
    const renderPois = (pois: Poi[]) => {
      for (const p of pois) {
        if (!poiCategories.includes(p.category)) continue;
        if (poiMarkersRef.current.has(p.id)) continue;
        const m = new google.maps.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          icon: poiIcon(p.category, p.id === selectedPoiId),
          zIndex: p.id === selectedPoiId ? 8 : 5,
          title: p.name || POI_META[p.category].label,
          optimized: true,
        });
        m.addListener("click", () => onPoiSelect?.(p));
        poiMarkersRef.current.set(p.id, { marker: m, poi: p });
      }
      // rimuovi solo i layer disattivati
      for (const [id, entry] of poiMarkersRef.current) {
        if (!poiCategories.includes(entry.poi.category)) {
          entry.marker.setMap(null);
          poiMarkersRef.current.delete(id);
        }
      }
    };

    // 1) mostra subito quelli già scaricati in sessione
    renderPois(getKnownPois(poiCategories));

    const runFetch = () => {
      const b = map.getBounds?.();
      if (!b) {
        // bounds not ready yet — retry shortly
        window.setTimeout(runFetch, 300);
        return;
      }
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      poiAbortRef.current?.abort();
      const ctrl = new AbortController();
      poiAbortRef.current = ctrl;
      onPoiLoadingChange?.(true);
      let poiCount = 0;
      let poiError: string | null = null;
      fetchPois([sw.lat(), sw.lng(), ne.lat(), ne.lng()], poiCategories, ctrl.signal)
        .then((pois) => {
          poiCount = pois.length;
          renderPois(pois);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") {
            poiError = e?.message ?? "Errore caricamento punti d'interesse";
            onRefreshError?.(poiError!);
          } else {
            poiError = "aborted";
          }
        })
        .finally(() => {
          onPoiLoadingChange?.(false);
          onRefreshComplete?.(
            poiError && poiError !== "aborted"
              ? { ok: false, error: poiError, count: poiCount }
              : { ok: true, count: poiCount },
          );
        });
    };

    const onIdle = () => {
      if (poiDebounceRef.current) window.clearTimeout(poiDebounceRef.current);
      poiDebounceRef.current = window.setTimeout(runFetch, 600);
    };

    runFetch();
    const listener = map.addListener("idle", onIdle);


    return () => {
      listener?.remove?.();
      if (poiDebounceRef.current) window.clearTimeout(poiDebounceRef.current);
      poiAbortRef.current?.abort();
    };
  }, [poiCategories.join(","), refreshKey, mapReady]);

  // Highlight selected POI marker
  useEffect(() => {
    const google = (window as any).google;
    if (!google?.maps) return;
    const scaleIcon = (cat: PoiCategory, selected: boolean) => {
      const meta = POI_META[cat];
      const scale = selected ? 1.25 : 1;
      const w = Math.round(32 * scale);
      const h = Math.round(40 * scale);
      const ring = selected
        ? `<circle cx="16" cy="15" r="14" fill="none" stroke="white" stroke-width="2" stroke-opacity="0.9"/>`
        : "";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 40">
        <g><path d="M16 38 C8 28 3 24 3 15 a13 13 0 1 1 26 0 c0 9 -5 13 -13 23z" fill="${meta.color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="15" r="8.5" fill="white"/>
        <text x="16" y="19" text-anchor="middle" font-size="11" font-family="system-ui">${meta.emoji}</text>${ring}</g>
      </svg>`;
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(w, h),
        anchor: new google.maps.Point(Math.round(w / 2), h),
      };
    };
    poiMarkersRef.current.forEach(({ marker, poi }) => {
      const isSel = poi.id === selectedPoiId;
      marker.setIcon(scaleIcon(poi.category, isSel));
      marker.setZIndex(isSel ? 8 : 5);
    });
  }, [selectedPoiId, mapReady]);

  // Route polyline (in-app navigation)
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    if (!routePath || routePath.length < 2) {
      if (routePolyRef.current) {
        routePolyRef.current.setMap(null);
        routePolyRef.current = null;
      }
      return;
    }

    if (!routePolyRef.current) {
      routePolyRef.current = new google.maps.Polyline({
        map,
        path: routePath,
        strokeColor: "#00B86B",
        strokeOpacity: 0.95,
        strokeWeight: 7,
        zIndex: 6,
      });
    } else {
      routePolyRef.current.setPath(routePath);
    }

    // Fit bounds to the route once
    try {
      const bounds = new google.maps.LatLngBounds();
      routePath.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { top: 110, right: 60, bottom: 220, left: 60 });
    } catch {}
  }, [routePath, mapReady]);

  // Marker + centratura per la destinazione scelta dalla ricerca
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;
    if (!focusPoi) {
      focusMarkerRef.current?.setMap(null);
      focusMarkerRef.current = null;
      return;
    }
    const pos = { lat: focusPoi.lat, lng: focusPoi.lng };
    if (!focusMarkerRef.current) {
      focusMarkerRef.current = new google.maps.Marker({ map, position: pos, zIndex: 9 });
    } else {
      focusMarkerRef.current.setPosition(pos);
      focusMarkerRef.current.setMap(map);
    }
    map.panTo(pos);
    if ((map.getZoom?.() ?? 0) < 15) map.setZoom(15);
  }, [focusPoi, mapReady]);





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

// Memoizzato: il recorder GPS aggiorna lo stato ogni secondo e senza memo
// l'intera mappa veniva riconciliata ad ogni tick.
export const GoogleMapView = memo(GoogleMapViewImpl);
