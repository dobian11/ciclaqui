import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Messaggio leggibile per l'utente a partire da un errore di serverFn/rete. */
function friendlyMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/unauthor|401|no authorization header/i.test(raw))
    return "Sessione scaduta: effettua di nuovo l'accesso.";
  if (/forbidden|403/i.test(raw)) return "Non hai i permessi per questa operazione.";
  if (/not found|404/i.test(raw)) return "Contenuto non disponibile.";
  if (/failed to fetch|network|timeout|aborted/i.test(raw))
    return "Connessione assente o lenta. Riprova tra poco.";
  return raw.slice(0, 160) || "Si è verificato un errore. Riprova.";
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        console.error(error);
        toast.error(friendlyMessage(error));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        console.error(error);
        toast.error(friendlyMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        // Evita refetch a raffica su navigazione/focus: l'app resta reattiva
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    // Riusa i dati precaricati invece di rieseguire i loader ad ogni hover/click
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  });

  return router;
};
