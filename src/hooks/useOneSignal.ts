import { useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sets up OneSignal push notifications via Median.co's JavaScript Bridge.
 * Handles: permission request, opt-in, login (external ID), and subscription verification.
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
        // Step 1: Request notification permission (required for Android 13+)
        if (typeof median.onesignal.requestPermission === "function") {
          median.onesignal.requestPermission({ fallbackToSettings: true });
          console.log("OneSignal requestPermission called");
        }

        // Step 2: Opt-in the user for push notifications
        if (typeof median.onesignal.optIn === "function") {
          median.onesignal.optIn();
          console.log("OneSignal optIn called");
        }

        // Step 3: Set external user ID (login)
        if (typeof median.onesignal.login === "function") {
          median.onesignal.login(user.id);
          console.log("OneSignal login called with user ID:", user.id);
        } else if (median.onesignal.externalUserId) {
          median.onesignal.externalUserId.set({ externalId: user.id });
          console.log("OneSignal externalUserId.set called:", user.id);
        }

        // Step 4: Retrieve info to verify subscription status
        if (typeof median.onesignal.info === "function") {
          median.onesignal.info().then((info: any) => {
            console.log("OneSignal info:", JSON.stringify(info));
            // If still not subscribed, try opt-in again
            if (info && !info.subscribed && typeof median.onesignal.optIn === "function") {
              median.onesignal.optIn();
              console.log("OneSignal re-optIn after check");
            }
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

    // Small delay to ensure Median bridge is fully initialized
    const timer = setTimeout(setupOneSignal, 1500);

    return () => {
      clearTimeout(timer);
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
