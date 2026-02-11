import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Calendar, MessageCircle, LayoutDashboard, UserPlus } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function useUnreadCount() {
  const { user } = useAuthContext();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      // Get conversations where this user is participant
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`);

      if (!convs || convs.length === 0) { setCount(0); return; }

      const convIds = convs.map(c => c.id);
      const { count: unread } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      setCount(unread ?? 0);
    };

    fetchUnread();

    // Listen for new messages in real-time
    const channel = supabase
      .channel("unread-counter")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        () => fetchUnread()
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function BottomNav() {
  const { user, isTeacher, isAdmin, isSupervisor } = useAuthContext();
  const location = useLocation();
  const unreadCount = useUnreadCount();

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
            <div className="relative">
              <MessageCircle className="h-5 w-5" />
              <UnreadBadge count={unreadCount} />
            </div>
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
          <div className="relative">
            <MessageCircle className="h-5 w-5" />
            <UnreadBadge count={unreadCount} />
          </div>
          <span>المحادثات</span>
        </Link>
      </div>
    </nav>
  );
}