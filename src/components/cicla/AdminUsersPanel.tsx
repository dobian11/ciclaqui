import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListUsers,
  adminSetUserRole,
  adminSetUserBlocked,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPagination } from "@/components/cicla/AdminListControls";
import { toast } from "sonner";
import { Loader2, Search, Lock, Unlock, Shield, Building2, User } from "lucide-react";

const ROLES = [
  { id: "user", label: "Utente", icon: User },
  { id: "company_manager", label: "Gestore ente", icon: Building2 },
  { id: "admin", label: "Admin", icon: Shield },
] as const;

const PAGE_SIZE = 8;

export function AdminUsersPanel() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);
  const setBlocked = useServerFn(adminSetUserBlocked);

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", query],
    queryFn: () => listUsers({ data: { query } }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const all = users ?? [];
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const items = all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const toggleRole = async (userId: string, role: string, has: boolean) => {
    setBusy(userId + role);
    try {
      await setRole({
        data: { user_id: userId, role: role as never, action: has ? "revoke" : "grant" },
      });
      toast.success(has ? "Ruolo rimosso" : "Ruolo assegnato");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operazione non riuscita");
    } finally {
      setBusy(null);
    }
  };

  const toggleBlock = async (userId: string, blocked: boolean) => {
    setBusy(userId + "block");
    try {
      await setBlocked({ data: { user_id: userId, blocked: !blocked } });
      toast.success(blocked ? "Utente sbloccato" : "Utente bloccato");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operazione non riuscita");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Utenti e ruoli
        </div>
        <span className="text-[11px] text-muted-foreground">{all.length} risultati</span>
      </div>

      <form
        className="relative mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
          setPage(1);
        }}
      >
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Cerca per nome o email…"
          className="h-9 pl-9 pr-20 text-[13px]"
        />
        <Button type="submit" size="sm" className="absolute right-1 top-1 h-7 px-3 text-[12px]">
          Cerca
        </Button>
      </form>

      {isLoading ? (
        <div className="mt-6 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">Nessun utente trovato.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((u) => (
            <li key={u.id} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{u.full_name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                  {u.company_name && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {u.company_name}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Iscritto {new Date(u.created_at).toLocaleDateString("it-IT")}
                    {u.last_sign_in_at
                      ? ` · ultimo accesso ${new Date(u.last_sign_in_at).toLocaleDateString("it-IT")}`
                      : ""}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    u.banned ? "bg-destructive/10 text-destructive" : "bg-cicla/10 text-cicla"
                  }
                >
                  {u.banned ? "Bloccato" : "Attivo"}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {ROLES.map((r) => {
                  const has = u.roles.includes(r.id);
                  const Icon = r.icon;
                  return (
                    <Button
                      key={r.id}
                      size="sm"
                      variant={has ? "default" : "outline"}
                      className="h-7 px-2.5 text-[11px]"
                      disabled={busy === u.id + r.id}
                      onClick={() => toggleRole(u.id, r.id, has)}
                    >
                      {busy === u.id + r.id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <Icon className="mr-1 size-3" />
                      )}
                      {r.label}
                    </Button>
                  );
                })}
              </div>

              <Button
                size="sm"
                variant="outline"
                className={`mt-2 w-full ${u.banned ? "" : "text-destructive"}`}
                disabled={busy === u.id + "block"}
                onClick={() => toggleBlock(u.id, u.banned)}
              >
                {busy === u.id + "block" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : u.banned ? (
                  <Unlock className="mr-1 size-3.5" />
                ) : (
                  <Lock className="mr-1 size-3.5" />
                )}
                {u.banned ? "Sblocca accesso" : "Blocca accesso"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AdminPagination
        page={current}
        pageCount={pageCount}
        total={all.length}
        onPage={setPage}
      />
    </Card>
  );
}
