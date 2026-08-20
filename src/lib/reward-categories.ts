/** Categorie premio condivise tra pannello ente e app dipendente. */
export const REWARD_CATEGORIES = [
  { value: "voucher", label: "Buono sconto", emoji: "🎟️", hint: "Codice da usare presso un partner" },
  { value: "service", label: "Tagliando / servizio", emoji: "🔧", hint: "Servizio gratuito (es. tagliando bici)" },
  { value: "product", label: "Prodotto", emoji: "📦", hint: "Un bene fisico da ritirare" },
  { value: "cash", label: "Denaro", emoji: "💶", hint: "Rimborso o bonifico" },
  { value: "donation", label: "Donazione", emoji: "❤️", hint: "Donazione a un ente benefico" },
  { value: "experience", label: "Esperienza", emoji: "🎫", hint: "Evento, corso o attività" },
  { value: "merch", label: "Gadget", emoji: "🧢", hint: "Merchandising dell'ente" },
] as const;

export type RewardCategory = (typeof REWARD_CATEGORIES)[number]["value"];

export const REWARD_CATEGORY_VALUES = REWARD_CATEGORIES.map((c) => c.value) as [
  RewardCategory,
  ...RewardCategory[],
];

export function rewardCategoryMeta(value: string) {
  return (
    REWARD_CATEGORIES.find((c) => c.value === value) ?? {
      value,
      label: "Premio",
      emoji: "🎁",
      hint: "",
    }
  );
}
