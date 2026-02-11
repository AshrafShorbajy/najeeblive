import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Video, Clock, CheckCircle, User } from "lucide-react";

export default function SchedulePage() {
  const { user } = useAuthContext();
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadBookings = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, lessons(title, duration_minutes)")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .order("scheduled_at", { ascending: true });

      const items = data ?? [];
      // Fetch teacher names for student's bookings
      const teacherIds = [...new Set(items.filter(b => b.student_id === user.id).map(b => b.teacher_id))];
      let teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", teacherIds);
        profiles?.forEach(p => { teacherMap[p.user_id] = p.full_name; });
      }
      setBookings(items.map(b => ({ ...b, teacher_name: teacherMap[b.teacher_id] || "" })));
    };
    loadBookings();
  }, [user]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: "في الانتظار",
      accepted: "مقبول",
      scheduled: "مجدول",
      completed: "مكتمل",
      cancelled: "ملغي",
    };
    return map[s] ?? s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-warning/10 text-warning",
      accepted: "bg-primary/10 text-primary",
      scheduled: "bg-accent/10 text-accent",
      completed: "bg-success/10 text-success",
      cancelled: "bg-destructive/10 text-destructive",
    };
    return map[s] ?? "";
  };

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">جدولي</h1>
        {bookings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد حصص محجوزة</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{(b as any).lessons?.title ?? "حصة"}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(b.status)}`}>
                    {statusLabel(b.status)}
                  </span>
                </div>
                {b.student_id === user?.id && b.teacher_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <User className="h-4 w-4" />
                    <span>المعلم: {b.teacher_name}</span>
                  </div>
                )}
                {b.scheduled_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(b.scheduled_at).toLocaleString("ar")}</span>
                  </div>
                )}
                {b.status === "scheduled" && (b.zoom_join_url || b.zoom_start_url) && (
                  <a
                    href={b.teacher_id === user?.id ? (b.zoom_start_url ?? b.zoom_join_url) : b.zoom_join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="hero" className="w-full">
                      <Video className="h-4 w-4 ml-2" />
                      {b.teacher_id === user?.id ? "بدء الحصة (زوم)" : "دخول الحصة عبر زوم"}
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
