import { Link } from "react-router-dom";
import { User, Heart, LayoutDashboard } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const { user, isAdmin, isTeacher, isSupervisor } = useAuthContext();
  const [siteLogo, setSiteLogo] = useState("");

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "site_logo").single()
      .then(({ data }) => {
        if (data && typeof data.value === "string" && data.value) setSiteLogo(data.value);
      });
  }, []);

  const dashboardLink = isAdmin ? "/admin" : isTeacher ? "/teacher/dashboard" : isSupervisor ? "/admin" : null;

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="container flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          {siteLogo ? (
            <img src={siteLogo} alt="لوجو الموقع" className="h-8 object-contain" />
          ) : (
            <span className="text-xl font-bold text-primary">منصة تعليم</span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {dashboardLink && (
                <Link to={dashboardLink}>
                  <Button variant="ghost" size="icon">
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                </Link>
              )}
              <NotificationBell />
              <Link to="/favorites">
                <Button variant="ghost" size="icon">
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="hero" size="sm">تسجيل الدخول</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
