import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** false: sin botón de cerrar y sin cerrar con Esc ni clic afuera (diálogos bloqueantes). */
  cerrable?: boolean;
}

export function DialogContent({ className, children, cerrable = true, ...props }: DialogContentProps) {
  const bloquear = (e: Event) => {
    if (!cerrable) e.preventDefault();
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40" />
      <DialogPrimitive.Content
        onEscapeKeyDown={bloquear}
        onPointerDownOutside={bloquear}
        onInteractOutside={bloquear}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-modal bg-white p-7 shadow-modal focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        {cerrable && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-control p-1.5 text-muted hover:bg-track hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-title font-bold text-ink", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-body text-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}
