import { useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationBanner() {
  const { user } = useAuthContext();
  const { permission, isSubscribed, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if: no user, already subscribed, permission denied, or dismissed
  if (!user || isSubscribed || permission === "denied" || dismissed) return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  const handleClick = async () => {
    await subscribe();
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between gap-3">
      <button
        onClick={handleClick}
        className="flex items-center gap-2 flex-1 text-start"
      >
        <Bell className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-foreground/80">
          الرجاء تفعيل التنبيهات ليصلكم تحديثات الحصص والمواعيد والتنبيهات المهمة.
        </p>
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
