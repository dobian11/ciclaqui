import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSubscriptionCheckout } from "@/lib/subscriptions.functions";
import type { PlanId } from "@/lib/plans";

/** Modulo di pagamento in pagina per l'abbonamento mensile dell'ente. */
export function SubscriptionCheckout({ plan }: { plan: PlanId }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createSubscriptionCheckout({
      data: {
        plan,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/azienda?checkout=done`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Pagamento non disponibile in questo momento");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="rounded-2xl bg-white p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
