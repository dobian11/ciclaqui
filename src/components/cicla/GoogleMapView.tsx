import { memo } from "react";
import { MapView } from "@/components/cicla/MapView";
import type { Poi, PoiCategory } from "@/lib/pois";

export type TripMode = "foot" | "bike" | "car";

export interface TripPathPoint {
  lat: number;
  lng: number;
}

/**
 * Mappa principale dell'app: OpenStreetMap (stile scuro CARTO), senza alcuna
 * chiave API. Il componente mantiene il nome e le props storiche così tutte
 * le schermate esistenti continuano a funzionare invariato.
 */
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
  focusPoi?: Poi | null;
  interactionsLocked?: boolean;
}) {
  return (
    <MapView
      position={position}
      mode={mode}
      follow={follow}
      path={path}
      poiCategories={poiCategories}
      refreshKey={refreshKey}
      onRefreshError={onRefreshError}
      onRefreshComplete={onRefreshComplete}
      onPoiLoadingChange={onPoiLoadingChange}
      onPoiSelect={onPoiSelect}
      selectedPoiId={selectedPoiId}
      routePath={routePath}
      focusPoi={focusPoi}
      interactionsLocked={interactionsLocked}
    />
  );
}

// Memoizzato: il recorder GPS aggiorna lo stato ogni secondo e senza memo
// l'intera mappa veniva riconciliata ad ogni tick.
export const GoogleMapView = memo(GoogleMapViewImpl);
