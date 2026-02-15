import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notification {
  id: string;
  type: "booking" | "message";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export function NotificationBell() {
  const { user, isTeacher } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element for notification sound
  useEffect(() => {
    // Use a simple beep via AudioContext
    audioRef.current = null; // We'll use AudioContext instead
  }, []);

  const playSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gain.gain.value = 0.3;
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not supported
    }
  }, []);

  const addNotification = useCallback(
    (notif: Omit<Notification, "id" | "read">) => {
      const newNotif: Notification = {
        ...notif,
        id: crypto.randomUUID(),
        read: false,
      };
      setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
      playSound();
    },
    [playSound]
  );

  // Listen for booking status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notif-bookings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        async (payload) => {
          const booking = payload.new as any;
          const old = payload.old as any;

          // Student: booking accepted
          if (
            booking.student_id === user.id &&
            old.status !== "accepted" &&
            booking.status === "accepted"
          ) {
            addNotification({
              type: "booking",
              title: "تم قبول حصتك",
              description: "تم قبول طلب الحصة الخاص بك، يمكنك بدء المحادثة مع المعلم",
              time: new Date().toLocaleString("ar"),
            });
          }

          // Student: booking scheduled
          if (
            booking.student_id === user.id &&
            old.status !== "scheduled" &&
            booking.status === "scheduled"
          ) {
            addNotification({
              type: "booking",
              title: "تم جدولة حصتك",
              description: "تم تحديد موعد الحصة، تحقق من جدولك",
              time: new Date().toLocaleString("ar"),
            });
          }

          // Teacher: new booking pending
          if (
            booking.teacher_id === user.id &&
            old.status !== "pending" &&
            booking.status === "pending"
          ) {
            addNotification({
              type: "booking",
              title: "طلب حصة جديد",
              description: "لديك طلب حصة جديد في انتظار الموافقة",
              time: new Date().toLocaleString("ar"),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);

  // Listen for new bookings (INSERT) for teacher
  useEffect(() => {
    if (!user || !isTeacher) return;

    const channel = supabase
      .channel(`notif-new-bookings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => {
          addNotification({
            type: "booking",
            title: "طلب حصة جديد",
            description: "لديك طلب حصة جديد",
            time: new Date().toLocaleString("ar"),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isTeacher, addNotification]);

  // Listen for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notif-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id !== user.id) {
            addNotification({
              type: "message",
              title: "رسالة جديدة",
              description: msg.content?.substring(0, 50) || "لديك رسالة جديدة",
              time: new Date().toLocaleString("ar"),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm">التنبيهات</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              تعيين الكل كمقروء
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              لا توجد تنبيهات
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b border-border last:border-0 ${
                  !n.read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      !n.read ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {n.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {n.time}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
