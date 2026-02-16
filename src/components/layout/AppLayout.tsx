import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { PushNotificationBanner } from "./PushNotificationBanner";
import { useOneSignal } from "@/hooks/useOneSignal";

export function AppLayout({ children }: { children: ReactNode }) {
  useOneSignal();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <PushNotificationBanner />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
