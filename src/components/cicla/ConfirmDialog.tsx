import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Se valorizzato mostra un campo di testo e ritorna il valore inserito. */
  input?: { label: string; placeholder?: string; required?: boolean };
};

export type ConfirmResult = { ok: boolean; value?: string };

type Pending = { opts: ConfirmOptions; resolve: (r: ConfirmResult) => void };

let listener: ((p: Pending | null) => void) | null = null;

/**
 * Conferma in-app con lo stile dell'app (sostituisce window.confirm/prompt nativi).
 * Richiede <ConfirmHost /> montato una volta nel root.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<ConfirmResult> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve({ ok: false });
      return;
    }
    listener({ opts, resolve });
  });
}

/** Piccolo helper per i componenti: const confirm = useConfirm(). */
export function useConfirm() {
  return confirmDialog;
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    listener = (p) => {
      setText("");
      setPending(p);
    };
    return () => {
      listener = null;
    };
  }, []);

  function close(ok: boolean) {
    pending?.resolve({ ok, value: ok ? text.trim() : undefined });
    setPending(null);
  }

  const opts = pending?.opts;
  const blocked = Boolean(opts?.input?.required && text.trim().length === 0);

  return (
    <AlertDialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          {opts?.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {opts?.input && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-input" className="text-xs">
              {opts.input.label}
            </Label>
            <Textarea
              id="confirm-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={opts.input.placeholder}
              rows={3}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {opts?.cancelLabel ?? "Annulla"}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            onClick={(e) => {
              if (blocked) {
                e.preventDefault();
                return;
              }
              close(true);
            }}
            className={
              opts?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {opts?.confirmLabel ?? "Conferma"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
