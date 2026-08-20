import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { friendlyMessage } from "@/lib/error-message";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Schermata di errore condivisa: sostituisce lo schermo bianco quando un
 * loader o una serverFn falliscono.
 */
export function ErrorScreen({
  error,
  reset,
  boundary = "route_error_component",
}: {
  error: Error;
  reset?: () => void;
  boundary?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary });
  }, [error, boundary]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Qualcosa è andato storto
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">{friendlyMessage(error)}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset?.();
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Riprova
        </button>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Home
        </a>
      </div>
    </div>
  );
}
