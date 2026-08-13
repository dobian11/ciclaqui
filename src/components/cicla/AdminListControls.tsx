import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AdminSort } from "@/hooks/use-admin-list";

const STATUS_LABELS: Record<string, string> = {
  all: "Tutti",
  pending: "In attesa",
  approved: "Approvati",
  rejected: "Rifiutati",
  suspended: "Sospesi",
  paid: "Pagati",
  confirmed: "Confermati",
  dismissed: "Legittimi",
};

const SORTS: { id: AdminSort; label: string }[] = [
  { id: "urgenza", label: "Urgenza" },
  { id: "recenti", label: "Più recenti" },
  { id: "vecchi", label: "Più vecchi" },
];

export function AdminListControls({
  query,
  onQuery,
  statuses,
  statusFilter,
  onStatus,
  sort,
  onSort,
  placeholder = "Cerca…",
}: {
  query: string;
  onQuery: (v: string) => void;
  statuses: string[];
  statusFilter: string;
  onStatus: (v: string) => void;
  sort: AdminSort;
  onSort: (v: AdminSort) => void;
  placeholder?: string;
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="h-9 pl-9 text-[13px]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {["all", ...statuses].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatus(s)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              statusFilter === s
                ? "border-cicla/50 bg-cicla/15 text-cicla"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s] ?? s}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSort(s.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                sort === s.id ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

export function AdminPagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">
        Pagina {page} di {pageCount} · {total} risultati
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Pagina precedente"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Pagina successiva"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
