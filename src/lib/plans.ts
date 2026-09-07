/**
 * Piani di abbonamento B2B/B2G di Cicla Qui.
 * Il numero di posti (`seats`) limita gli account che possono collegarsi
 * all'ente con il codice: il vincolo è applicato anche a livello di database.
 */
export type PlanId = "starter" | "pro" | "advanced" | "enterprise";

export const UNLIMITED_SEATS = 1_000_000;

export type Plan = {
  id: PlanId;
  name: string;
  /** Prezzo mensile in euro; `null` per i piani su misura. */
  priceEur: number | null;
  seats: number;
  seatsLabel: string;
  highlights: string[];
  /** Identificativo del prezzo ricorrente mensile nel sistema di pagamento. */
  priceId: string;
  /** Piano su richiesta: non acquistabile direttamente dal pannello. */
  custom?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Base",
    priceEur: 99,
    seats: 10,
    seatsLabel: "fino a 10 utenti",
    highlights: ["Codice ente", "Classifica e sfide", "Premi e voucher"],
    priceId: "starter_monthly",
  },
  {
    id: "pro",
    name: "Intermedio",
    priceEur: 199,
    seats: 50,
    seatsLabel: "fino a 50 utenti",
    highlights: ["Tutto di Base", "Report avanzati", "Sfide personalizzate"],
    priceId: "pro_monthly",
  },
  {
    id: "advanced",
    name: "Avanzato",
    priceEur: 299,
    seats: 300,
    seatsLabel: "fino a 300 utenti",
    highlights: ["Tutto di Intermedio", "Coppe e maratone su misura", "Supporto prioritario"],
    priceId: "advanced_monthly",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceEur: null,
    seats: UNLIMITED_SEATS,
    seatsLabel: "oltre 300 utenti",
    highlights: ["Piano personalizzato", "Utenti illimitati", "Referente dedicato"],
    priceId: "",
    custom: true,
  },
];

/** Piani acquistabili con carta dal pannello dell'ente. */
export const PURCHASABLE_PLANS = PLANS.filter((p) => !p.custom);

/** Email a cui arrivano le richieste per il piano su misura. */
export const ENTERPRISE_CONTACT_EMAIL = "info@ciclaqui.it";

export function getPlan(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}

export function planPrice(id: string): number {
  return getPlan(id).priceEur ?? 0;
}

export function formatSeats(seats: number): string {
  return seats >= UNLIMITED_SEATS ? "illimitati" : String(seats);
}

export function planByPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANS.find((p) => p.priceId && p.priceId === priceId) ?? null;
}
