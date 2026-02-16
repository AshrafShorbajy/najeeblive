import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BCQ1GFDpp8iuw0nkFjTLH6wuirLPihTq8GS2vPulzZI4dZd3QCgTTkhuKoCBUdbBwmJEsouwBjKX857hiqKhUHA";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuthContext();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!user || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Register service worker and check existing subscription
    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const reg = registration as any;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setIsSubscribed(true);
        // Save to DB in case it's not there
        await saveSubscription(existing);
      }
    });
  }, [user]);

  const subscribe = async () => {
    if (!user) return;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const registration = await navigator.serviceWorker.ready as any;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await saveSubscription(subscription);
      setIsSubscribed(true);
    } catch (error) {
      console.error("Push subscription failed:", error);
    }
  };

  const saveSubscription = async (subscription: PushSubscription) => {
    if (!user) return;

    const json = subscription.toJSON();
    const endpoint = json.endpoint!;
    const p256dh = json.keys!.p256dh!;
    const auth = json.keys!.auth!;

    // Upsert: if endpoint exists (same device, different user), update owner
    // Uses the unique constraint on endpoint
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("Failed to save push subscription:", error);
    }
  };

  return { permission, isSubscribed, subscribe };
}
