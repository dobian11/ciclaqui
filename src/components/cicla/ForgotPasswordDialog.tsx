import { useState } from "react";
import { emailLinkOrigin } from "@/lib/public-url";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  /** Testo del link mostrato nel form di login */
  label?: string;
}

export function ForgotPasswordDialog({ label = "Password dimenticata?" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    if (!email) return toast.error("Inserisci la tua email");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${emailLinkOrigin()}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(email);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSent(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs font-semibold text-cicla underline-offset-2 hover:underline"
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Recupera l'accesso</DialogTitle>
          <DialogDescription>
            Ti inviamo un link per impostare una nuova password. Vale 60 minuti.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="rounded-xl border border-cicla/30 bg-cicla/10 p-4">
            <p className="text-sm font-semibold">Email inviata</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Se <strong>{sent}</strong> è registrata, riceverai il link per reimpostare
              la password. Controlla anche la cartella spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fp-email">Email dell'account</Label>
              <Input id="fp-email" name="email" type="email" required autoComplete="email" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Inviami il link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
