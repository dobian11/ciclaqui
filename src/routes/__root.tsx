import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/cicla/ConfirmDialog";
import { CookieBanner } from "@/components/cicla/CookieBanner";
import { PerfProvider } from "@/components/cicla/PerfPanel";
import { BootSplash } from "@/components/cicla/BootSplash";
import { friendlyMessage } from "@/lib/error-message";
import { toast } from "sonner";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina non trovata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Qualcosa è andato storto
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Riprova o torna alla home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
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
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "google-site-verification", content: "L7P4XTVjgKOsASSVEjd6bnNJmArJp2L64CTJNXo8Zcg" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover, interactive-widget=overlays-content",
      },
      { name: "theme-color", content: "#00B86B" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Cicla Qui" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Cicla Qui" },
      {
        name: "description",
        content:
          "Cicla Qui: l'app di mobilità sostenibile per dipendenti, cittadini, aziende e comuni.",
      },
      { name: "author", content: "Cicla Qui" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Cicla Qui" },
      { property: "og:locale", content: "it_IT" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Cicla Qui",
              url: "https://ciclaqui.it",
              logo: "https://ciclaqui.it/icons/icon-512.png",
            },
            {
              "@type": "WebSite",
              name: "Cicla Qui",
              url: "https://ciclaqui.it",
              inLanguage: "it-IT",
            },
          ],
        }),
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Mappa: apre in anticipo le connessioni verso Google Maps e i tile server
      // così il primo render della mappa non paga handshake DNS/TLS.
      { rel: "preconnect", href: "https://maps.googleapis.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://maps.gstatic.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://khms0.googleapis.com" },
      { rel: "dns-prefetch", href: "https://connector-gateway.lovable.dev" },

      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/icon-180.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  // Errori asincroni non gestiti (es. serverFn chiamate fuori da React Query):
  // mostra un toast invece di lasciare l'utente davanti a una schermata vuota.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      console.error(event.reason);
      toast.error(friendlyMessage(event.reason));
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PerfProvider>
        <Outlet />
      </PerfProvider>
      <Toaster richColors position="top-center" />
      <ConfirmHost />
      <CookieBanner />
      <BootSplash />
    </QueryClientProvider>
  );
}

