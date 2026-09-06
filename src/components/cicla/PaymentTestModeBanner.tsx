const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

/** Avviso ambiente di test / pagamenti non configurati. */
export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-[12px] text-destructive">
        I pagamenti reali non sono ancora configurati per questa versione pubblicata.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-center text-[12px] text-warning">
        Modalità test: i pagamenti effettuati qui non addebitano denaro reale.
      </div>
    );
  }
  return null;
}
