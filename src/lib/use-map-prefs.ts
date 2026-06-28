// Persists user UI preferences (map layers, follow) to localStorage immediately
// and syncs them to profiles.preferences when signed in. localStorage hydrates
// instantly; the server copy keeps them across devices.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PoiCategory } from "@/lib/pois";

export interface MapPrefs {
  poiCategories: PoiCategory[];
  follow: boolean;
}

const LS_KEY = "cicla:map-prefs:v1";
const DEFAULTS: MapPrefs = { poiCategories: [], follow: true };

function readLocal(): MapPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      poiCategories: Array.isArray(parsed.poiCategories) ? parsed.poiCategories : [],
      follow: typeof parsed.follow === "boolean" ? parsed.follow : true,
    };
  } catch {
    return DEFAULTS;
  }
}

function writeLocal(p: MapPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {}
}

export function useMapPrefs() {
  const [prefs, setPrefs] = useState<MapPrefs>(() =>
    typeof window === "undefined" ? DEFAULTS : readLocal(),
  );
  const hydratedFromServer = useRef(false);
  const saveTimer = useRef<number | null>(null);

  // Hydrate from server once we have a session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;
      const { data: row, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || error || !row?.preferences) {
        hydratedFromServer.current = true;
        return;
      }
      const remote = (row.preferences as any)?.map as Partial<MapPrefs> | undefined;
      if (remote) {
        const merged: MapPrefs = {
          poiCategories: Array.isArray(remote.poiCategories) ? remote.poiCategories : prefs.poiCategories,
          follow: typeof remote.follow === "boolean" ? remote.follow : prefs.follow,
        };
        setPrefs(merged);
        writeLocal(merged);
      }
      hydratedFromServer.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist changes: localStorage immediately + debounced server sync
  useEffect(() => {
    writeLocal(prefs);
    if (!hydratedFromServer.current) return; // avoid overwriting server with defaults pre-hydration
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return;
        // merge map prefs into existing preferences jsonb
        const { data: row } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", userId)
          .maybeSingle();
        const next = { ...((row?.preferences as any) ?? {}), map: prefs };
        await supabase.from("profiles").update({ preferences: next }).eq("id", userId);
      } catch {
        // never break UX on sync failures
      }
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [prefs]);

  return {
    prefs,
    setPoiCategories: (cats: PoiCategory[]) => setPrefs((p) => ({ ...p, poiCategories: cats })),
    togglePoi: (cat: PoiCategory) =>
      setPrefs((p) => ({
        ...p,
        poiCategories: p.poiCategories.includes(cat)
          ? p.poiCategories.filter((c) => c !== cat)
          : [...p.poiCategories, cat],
      })),
    setFollow: (f: boolean) => setPrefs((p) => ({ ...p, follow: f })),
  };
}
