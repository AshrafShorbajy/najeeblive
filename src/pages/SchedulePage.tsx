import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, Clock, CheckCircle, User, MessageCircle, Send, ArrowRight, Upload, PlayCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VideoPlayer } from "@/components/schedule/VideoPlayer";

export default function SchedulePage() {
  const { user, isTeacher } = useAuthContext();
  const [bookings, setBookings] = useState<any[]>([]);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [watchingBooking, setWatchingBooking] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const loadBookings = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, lessons(title, duration_minutes)")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .order("scheduled_at", { ascending: true });

      const items = data ?? [];
      console.log("DEBUG: Loaded bookings for user", user.id, "count:", items.length);
      console.log("DEBUG: Completed bookings with recording:", items.filter(b => b.status === 'completed' && b.recording_url).map(b => ({ id: b.id, recording_url: b.recording_url, student_id: b.student_id })));
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

    // Realtime: auto-update when booking recording_url changes
    const channel = supabase
      .channel("bookings-recordings")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "bookings",
      }, (payload) => {
        const updated = payload.new as any;
        setBookings(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Upload recording handler (teacher only)
  const handleUploadRecording = async (bookingId: string, teacherId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 500 * 1024 * 1024) {
        toast.error("حجم الملف كبير جداً (الحد الأقصى 500 ميغابايت)");
        return;
      }

      setUploadingId(bookingId);
      try {
        const ext = file.name.split(".").pop();
        const path = `${teacherId}/${bookingId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("recordings")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("recordings")
          .getPublicUrl(path);

        const { error: updateError } = await supabase
          .from("bookings")
          .update({ recording_url: urlData.publicUrl })
          .eq("id", bookingId);

        if (updateError) throw updateError;

        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, recording_url: urlData.publicUrl } : b));
        toast.success("تم رفع التسجيل بنجاح");
      } catch (err: any) {
        console.error(err);
        toast.error("خطأ في رفع التسجيل");
      } finally {
        setUploadingId(null);
      }
    };
    input.click();
  };

  // Open chat for a booking
  const openChat = async (booking: any) => {
    if (!user) return;
    setChatBookingId(booking.id);
    const { data: existing } = await supabase
      .from("conversations").select("id").eq("booking_id", booking.id).maybeSingle();
    if (existing) {
      setConversationId(existing.id);
      loadMessages(existing.id);
    } else {
      const { data: created, error } = await supabase.from("conversations").insert({
        student_id: booking.student_id, teacher_id: booking.teacher_id, booking_id: booking.id,
      }).select("id").single();
      if (error) { toast.error("خطأ في فتح المحادثة"); return; }
      setConversationId(created.id);
      setMessages([]);
    }
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at");
    setMessages(data ?? []);
  };

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`schedule-msgs-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages(prev => [...prev, payload.new as any])
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !conversationId || !user) return;
    await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, content: newMsg.trim() });
    setNewMsg("");
  };

  const currentBooking = bookings.find(b => b.id === chatBookingId);
  const isChatReadOnly = currentBooking?.status === "completed";

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: "في الانتظار", accepted: "مقبول", scheduled: "مجدول", completed: "مكتمل", cancelled: "ملغي" };
    return map[s] ?? s;
  };
  const statusColor = (s: string) => {
    const map: Record<string, string> = { pending: "bg-warning/10 text-warning", accepted: "bg-primary/10 text-primary", scheduled: "bg-accent/10 text-accent", completed: "bg-success/10 text-success", cancelled: "bg-destructive/10 text-destructive" };
    return map[s] ?? "";
  };

  // Video player view
  if (watchingBooking) {
    return (
      <AppLayout>
        <div className="px-4 py-6 max-w-3xl mx-auto">
          <button onClick={() => setWatchingBooking(null)} className="text-sm text-primary flex items-center gap-1 mb-4">
            <ArrowRight className="h-4 w-4" />
            رجوع للجدول
          </button>
          <h2 className="text-lg font-bold mb-4">{watchingBooking.lessons?.title ?? "تسجيل الحصة"}</h2>
          <VideoPlayer
            src={watchingBooking.recording_url}
            title={watchingBooking.lessons?.title}
          />
        </div>
      </AppLayout>
    );
  }

  // Chat view
  if (chatBookingId && conversationId !== null) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-8rem)]">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <button onClick={() => { setChatBookingId(null); setConversationId(null); setMessages([]); }} className="text-sm text-primary flex items-center gap-1">
              <ArrowRight className="h-4 w-4" />
              رجوع
            </button>
            <span className="font-semibold text-sm flex-1">محادثة: {currentBooking?.lessons?.title ?? "حصة"}</span>
            {isChatReadOnly && <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">للقراءة فقط</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد رسائل بعد</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {!isChatReadOnly && (
            <div className="p-3 border-t border-border flex gap-2">
              <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="اكتب رسالتك..." onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
              <Button onClick={sendMessage} size="icon" variant="hero"><Send className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">جدولي</h1>
        <Tabs defaultValue="scheduled" dir="rtl">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="scheduled">مجدول</TabsTrigger>
            <TabsTrigger value="accepted">مقبول</TabsTrigger>
            <TabsTrigger value="pending">في الانتظار</TabsTrigger>
            <TabsTrigger value="completed">مكتمل</TabsTrigger>
          </TabsList>
          {["scheduled", "accepted", "pending", "completed"].map((status) => {
            const filtered = bookings.filter((b) => b.status === status);
            return (
              <TabsContent key={status} value={status}>
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">لا توجد حصص</p>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((b) => (
                      <div key={b.id} className="bg-card rounded-xl p-4 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{(b as any).lessons?.title ?? "حصة"}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(b.status)}`}>{statusLabel(b.status)}</span>
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
                        {b.status === "scheduled" && b.teacher_id === user?.id && isTeacher && (
                          <Button size="sm" variant="outline" className="w-full mb-2 text-success border-success/30 hover:bg-success/10"
                            onClick={async () => {
                              const { error } = await supabase.from("bookings").update({
                                status: "completed", zoom_join_url: null, zoom_start_url: null, zoom_meeting_id: null,
                              }).eq("id", b.id);
                              if (error) toast.error("خطأ في تحديث الحالة");
                              else {
                                toast.success("تم إنهاء الحصة بنجاح");
                                setBookings(prev => prev.map(item => item.id === b.id ? { ...item, status: "completed", zoom_join_url: null, zoom_start_url: null, zoom_meeting_id: null } : item));
                              }
                            }}>
                            <CheckCircle className="h-4 w-4 ml-2" />
                            إنهاء الحصة
                          </Button>
                        )}
                        {b.status === "scheduled" && (b.zoom_join_url || b.zoom_start_url) && (
                          <a href={b.teacher_id === user?.id ? (b.zoom_start_url ?? b.zoom_join_url) : b.zoom_join_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="hero" className="w-full mb-2">
                              <Video className="h-4 w-4 ml-2" />
                              {b.teacher_id === user?.id ? "بدء الحصة (زوم)" : "دخول الحصة عبر زوم"}
                            </Button>
                          </a>
                        )}
                        {b.status === "completed" && b.teacher_id === user?.id && isTeacher && !b.recording_url && (
                          <Button size="sm" variant="outline" className="w-full mb-2 text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => handleUploadRecording(b.id, b.teacher_id)}
                            disabled={uploadingId === b.id}>
                            {uploadingId === b.id ? (
                              <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الرفع...</>
                            ) : (
                              <><Upload className="h-4 w-4 ml-2" />رفع تسجيل الحصة</>
                            )}
                          </Button>
                        )}
                        {b.status === "completed" && b.teacher_id === user?.id && isTeacher && b.recording_url && (
                          <div className="flex items-center gap-2 text-sm text-success mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span>تم رفع التسجيل</span>
                          </div>
                        )}
                        {b.status === "completed" && b.student_id === user?.id && b.recording_url && (
                          <Button size="sm" variant="outline" className="w-full mb-2 text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => setWatchingBooking(b)}>
                            <PlayCircle className="h-4 w-4 ml-2" />
                            مشاهدة تسجيل الحصة
                          </Button>
                        )}
                        {b.student_id === user?.id && (b.status === "accepted" || b.status === "scheduled" || b.status === "completed") && (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => openChat(b)}>
                            <MessageCircle className="h-4 w-4 ml-2" />
                            {b.status === "completed" ? "عرض المحادثة" : "مراسلة المعلم"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppLayout>
  );
}
