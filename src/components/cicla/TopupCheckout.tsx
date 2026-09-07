import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCompanyTopupCheckout } from "@/lib/company-wallet.functions";

/** Pagamento con carta della ricarica del conto ente (accredito automatico). */
export function TopupCheckout({ amountEur }: { amountEur: number }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createCompanyTopupCheckout({
      data: {
        amount_eur: amountEur,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/azienda?section=prelievi&topup=done`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Pagamento non disponibile in questo momento");
    return result.clientSecret;
  };

  return (
    <div className="rounded-2xl bg-white p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
