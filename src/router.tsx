import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { friendlyMessage } from "./lib/error-message";
import { ErrorScreen } from "./components/cicla/ErrorScreen";

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
    // Nessuno schermo bianco: ogni errore di loader/serverFn mostra la schermata dedicata
    defaultErrorComponent: ({ error, reset }: ErrorComponentProps) => (
      <ErrorScreen error={error instanceof Error ? error : new Error(String(error))} reset={reset} />
    ),
  });

  return router;
};
