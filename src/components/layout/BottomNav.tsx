import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Calendar, MessageCircle, LayoutDashboard, UserPlus } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

export function BottomNav() {
  const { user, isTeacher, isAdmin, isSupervisor } = useAuthContext();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) =>
    `flex flex-col items-center gap-1 text-xs transition-colors ${
      isActive(path) ? "text-primary font-bold" : "text-muted-foreground"
    }`;

  if (!user) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-2 shadow-elevated">
        <div className="flex justify-center">
          <Link to="/auth" className={linkClass("/auth")}>
            <UserPlus className="h-5 w-5" />
            <span>سجل معنا</span>
          </Link>
        </div>
      </nav>
    );
  }

  if (isAdmin || isSupervisor) return null;

  if (isTeacher) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-2 shadow-elevated">
        <div className="flex justify-around">
          <Link to="/" className={linkClass("/")}>
            <Home className="h-5 w-5" />
            <span>الرئيسية</span>
          </Link>
          <Link to="/teacher/dashboard" className={linkClass("/teacher/dashboard")}>
            <LayoutDashboard className="h-5 w-5" />
            <span>لوحة التحكم</span>
          </Link>
          <Link to="/messages" className={linkClass("/messages")}>
            <MessageCircle className="h-5 w-5" />
            <span>المحادثات</span>
          </Link>
          <Link to="/schedule" className={linkClass("/schedule")}>
            <Calendar className="h-5 w-5" />
            <span>جدولي</span>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-2 shadow-elevated">
      <div className="flex justify-around">
        <Link to="/" className={linkClass("/")}>
          <Home className="h-5 w-5" />
          <span>الرئيسية</span>
        </Link>
        <Link to="/lessons" className={linkClass("/lessons")}>
          <BookOpen className="h-5 w-5" />
          <span>الدروس</span>
        </Link>
        <Link to="/schedule" className={linkClass("/schedule")}>
          <Calendar className="h-5 w-5" />
          <span>جدولي</span>
        </Link>
        <Link to="/messages" className={linkClass("/messages")}>
          <MessageCircle className="h-5 w-5" />
          <span>المحادثات</span>
        </Link>
      </div>
    </nav>
  );
}
