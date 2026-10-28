"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { toastManager } from "@/lib/toast";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Affiché en haut de /online-orders (même garde ecommerce:manage que la
// page elle-même) — permet à un admin d'activer/désactiver les notifications
// push de nouvelle commande sur CE navigateur/appareil.
export function PushSubscribeButton() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let ignore = false;

    (async () => {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!ignore) setPermission("unsupported");
        return;
      }

      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = registration
        ? await registration.pushManager.getSubscription().catch(() => null)
        : null;
      if (ignore) return;
      setPermission(Notification.permission as PermissionState);
      setSubscribed(subscription !== null);
    })();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubscribe() {
    setPending(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== "granted") return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toastManager.add({
          title: "Notifications push indisponibles",
          description: "Clé VAPID manquante côté serveur.",
        });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");

      setSubscribed(true);
      toastManager.add({
        title: "Notifications activées",
        description: "Vous recevrez une notification à chaque nouvelle commande.",
      });
    } catch {
      toastManager.add({
        title: "Échec de l'activation",
        description: "Réessayez, ou vérifiez les permissions de notification du navigateur.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleUnsubscribe() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setPending(false);
    }
  }

  if (permission === "unsupported") return null;

  if (permission === "denied") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BellOff className="size-3.5" />
        Notifications bloquées — autorisez-les dans les réglages du navigateur pour ce site.
      </p>
    );
  }

  if (subscribed) {
    return (
      <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={pending} onClick={handleUnsubscribe}>
        <BellRing className="size-3.5" />
        Notifications activées
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={handleSubscribe}>
      <Bell className="size-3.5" />
      {pending ? "Activation..." : "Activer les notifications"}
    </Button>
  );
}
