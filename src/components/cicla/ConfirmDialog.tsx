import { useCallback, useState } from "react";
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

type Pending = {
  opts: ConfirmOptions;
  resolve: (value: { ok: boolean; value?: string }) => void;
};

/**
 * Conferma in-app con lo stile dell'app (niente window.confirm/prompt nativi).
 * Uso: const { confirm, dialog } = useConfirm(); ... if (!(await confirm({...})).ok) return;
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<{ ok: boolean; value?: string }>((resolve) => {
        setText("");
        setPending({ opts, resolve });
      }),
    [],
  );

  function close(ok: boolean) {
    pending?.resolve({ ok, value: ok ? text.trim() : undefined });
    setPending(null);
  }

  const opts = pending?.opts;
  const blocked = Boolean(opts?.input?.required && text.trim().length === 0);

  const dialog = (
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

  return { confirm, dialog };
}
