import { useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sets the OneSignal External User ID via Median.co's JavaScript Bridge.
 * When the web app runs inside a Median native wrapper, the global
 * `median` object is available and allows calling OneSignal APIs.
 * On regular browsers this hook is a no-op.
 */
export function useOneSignal() {
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) return;

    const setupOneSignal = async () => {
      // Check if OneSignal is enabled in site settings
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "onesignal_settings")
        .maybeSingle();

      const settings = data?.value as { enabled?: boolean; app_id?: string } | null;
      if (!settings?.enabled || !settings?.app_id) return;

      // Median.co JavaScript Bridge for OneSignal
      const median = (window as any).median;
      if (median?.onesignal) {
        try {
          // Set external user ID so push notifications target this user
          median.onesignal.externalUserId.set({ externalId: user.id });
          console.log("OneSignal external user ID set:", user.id);
        } catch (err) {
          console.warn("OneSignal bridge error:", err);
        }
      }
    };

    setupOneSignal();
  }, [user]);
}
