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
      if (!median?.onesignal) return;

      try {
        // Use the modern login method (OneSignal SDK v5+)
        // This replaces the deprecated externalUserId.set()
        if (typeof median.onesignal.login === "function") {
          median.onesignal.login(user.id);
          console.log("OneSignal login called with user ID:", user.id);
        } else if (median.onesignal.externalUserId) {
          // Fallback for older SDK versions
          median.onesignal.externalUserId.set({ externalId: user.id });
          console.log("OneSignal externalUserId.set called:", user.id);
        }

        // Retrieve OneSignal info to verify subscription
        if (typeof median.onesignal.info === "function") {
          median.onesignal.info().then((info: any) => {
            console.log("OneSignal info:", JSON.stringify(info));
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("OneSignal bridge error:", err);
      }
    };

    // Define global callback for OneSignal info (called on each page load by Median)
    (window as any).median_onesignal_info = (info: any) => {
      console.log("OneSignal info callback:", JSON.stringify(info));
    };

    setupOneSignal();

    return () => {
      delete (window as any).median_onesignal_info;
    };
  }, [user]);

  // Handle logout - clear OneSignal external ID
  useEffect(() => {
    if (user) return;

    const median = (window as any).median;
    if (median?.onesignal) {
      try {
        if (typeof median.onesignal.logout === "function") {
          median.onesignal.logout();
          console.log("OneSignal logout called");
        }
      } catch {
        // ignore
      }
    }
  }, [user]);
}
