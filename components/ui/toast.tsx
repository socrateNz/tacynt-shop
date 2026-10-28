"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitive.Provider

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        className={cn(
          "fixed top-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2",
          className
        )}
        {...props}
      />
    </ToastPrimitive.Portal>
  )
}

function ToastRoot({ className, toast, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      toast={toast}
      className={cn(
        "relative flex flex-col gap-1 rounded-lg border border-border bg-popover p-4 pr-8 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-all data-[swipe-direction]:transition-none data-starting-style:translate-x-full data-starting-style:opacity-0 data-ending-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Fermer"
      className={cn(
        "absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      <X className="size-3.5" />
    </ToastPrimitive.Close>
  )
}

// Rend les toasts ajoutés via lib/toast.ts (toastManager.add(...)) depuis
// n'importe où dans l'app — monté une seule fois (app/(admin)/toast-host.tsx)
// à l'intérieur d'un <ToastProvider toastManager={toastManager}>.
function Toaster() {
  const { toasts } = ToastPrimitive.useToastManager()

  return (
    <ToastViewport>
      {toasts.map((toast) => (
        <ToastRoot key={toast.id} toast={toast}>
          {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
          {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          <ToastClose />
        </ToastRoot>
      ))}
    </ToastViewport>
  )
}

export { ToastProvider, Toaster }
