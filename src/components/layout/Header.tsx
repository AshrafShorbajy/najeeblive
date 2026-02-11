import { Link } from "react-router-dom";
import { User, Heart, LayoutDashboard } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, isAdmin, isTeacher, isSupervisor } = useAuthContext();

  const dashboardLink = isAdmin ? "/admin" : isTeacher ? "/teacher-dashboard" : isSupervisor ? "/admin" : null;

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="container flex items-center justify-between h-14">
        <Link to="/" className="text-xl font-bold text-primary">
          منصة تعليم
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
