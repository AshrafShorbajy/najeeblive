import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { PushNotificationBanner } from "./PushNotificationBanner";
import { useOneSignal } from "@/hooks/useOneSignal";
import { useThemeSettings } from "@/hooks/useThemeSettings";

export function AppLayout({ children }: { children: ReactNode }) {
  useOneSignal();
  useThemeSettings();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <PushNotificationBanner />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
