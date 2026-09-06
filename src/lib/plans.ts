/**
 * Piani di abbonamento B2B/B2G di Cicla Qui.
 * Il numero di posti (`seats`) limita gli account che possono collegarsi
 * all'ente con il codice: il vincolo è applicato anche a livello di database.
 */
export type PlanId = "starter" | "pro" | "enterprise";

export const UNLIMITED_SEATS = 1_000_000;

export type Plan = {
  id: PlanId;
  name: string;
  priceEur: number;
  seats: number;
  seatsLabel: string;
  highlights: string[];
  /** Identificativo del prezzo ricorrente mensile nel sistema di pagamento. */
  priceId: string;
};


export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceEur: 29,
    seats: 10,
    seatsLabel: "fino a 10 account",
    highlights: ["Codice ente", "Classifica e sfide", "Premi e voucher"],
    priceId: "starter_monthly",
  },
  {
    id: "pro",
    name: "Pro",
    priceEur: 99,
    seats: 50,
    seatsLabel: "fino a 50 account",
    highlights: ["Tutto di Starter", "Report avanzati", "Sfide personalizzate"],
    priceId: "pro_monthly",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceEur: 149,
    seats: UNLIMITED_SEATS,
    seatsLabel: "account illimitati",
    highlights: ["Tutto di Pro", "Account illimitati", "Supporto prioritario"],
    priceId: "enterprise_monthly",
  },
];

export function getPlan(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}

export function formatSeats(seats: number): string {
  return seats >= UNLIMITED_SEATS ? "illimitati" : String(seats);
}

export function planByPriceId(priceId: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.priceId === priceId) ?? null;
}
