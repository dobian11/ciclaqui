import { useMemo, useState } from "react";

export type AdminSort = "urgenza" | "recenti" | "vecchi";

type Options<T> = {
  items: T[] | undefined;
  /** Testo su cui applicare la ricerca libera */
  searchText: (item: T) => string;
  /** Stato usato dal filtro (es. pending/approved/…) */
  status: (item: T) => string;
  /** Data di riferimento per l'ordinamento */
  date: (item: T) => string | number | Date;
  /** Peso di urgenza (più alto = più urgente) a parità di stato pending */
  urgency?: (item: T) => number;
  pageSize?: number;
};

/**
 * Ricerca + filtro stato + ordinamento (urgenza/data) + paginazione lato client
 * per le liste del pannello admin.
 */
export function useAdminList<T>({
  items,
  searchText,
  status,
  date,
  urgency,
  pageSize = 8,
}: Options<T>) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<AdminSort>("urgenza");
  const [page, setPage] = useState(1);

  const all = useMemo(() => items ?? [], [items]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const it of all) set.add(status(it));
    return Array.from(set).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((it) => {
      if (statusFilter !== "all" && status(it) !== statusFilter) return false;
      if (!q) return true;
      return searchText(it).toLowerCase().includes(q);
    });

    const ts = (it: T) => new Date(date(it)).getTime() || 0;

    return [...list].sort((a, b) => {
      if (sort === "recenti") return ts(b) - ts(a);
      if (sort === "vecchi") return ts(a) - ts(b);
      // urgenza: pending prima, poi peso urgenza, poi più vecchi prima
      const pa = status(a) === "pending" ? 1 : 0;
      const pb = status(b) === "pending" ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ua = urgency?.(a) ?? 0;
      const ub = urgency?.(b) ?? 0;
      if (ua !== ub) return ub - ua;
      return ts(a) - ts(b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query, statusFilter, sort]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function reset<V>(setter: (v: V) => void) {
    return (v: V) => {
      setter(v);
      setPage(1);
    };
  }

  return {
    query,
    setQuery: reset(setQuery),
    statusFilter,
    setStatusFilter: reset(setStatusFilter),
    statuses,
    sort,
    setSort: reset(setSort),
    page: safePage,
    setPage,
    pageCount,
    total,
    items: pageItems,
  };
}
