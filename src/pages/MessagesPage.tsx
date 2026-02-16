import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MessagesPage() {
  const { user } = useAuthContext();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadConversations = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*, bookings:booking_id(status, lessons:lesson_id(title))")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`);
      
      if (!data || data.length === 0) {
        setConversations([]);
        return;
      }

      const userIds = [...new Set(data.flatMap(c => [c.student_id, c.teacher_id]))];
      const convIds = data.map(c => c.id);

      const [{ data: profiles }, { data: unreadMsgs }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("messages").select("conversation_id").in("conversation_id", convIds).neq("sender_id", user.id).eq("is_read", false),
      ]);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
      const unreadMap = new Map<string, number>();
      unreadMsgs?.forEach(m => unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1));
      
      const enriched = data.map(c => ({
        ...c,
        student_name: profileMap.get(c.student_id) ?? "طالب",
        teacher_name: profileMap.get(c.teacher_id) ?? "معلم",
        lesson_title: (c.bookings as any)?.lessons?.title ?? null,
        unread_count: unreadMap.get(c.id) ?? 0,
      }));
      setConversations(enriched);
    };
    loadConversations();

    // Realtime: auto-refresh conversations list on new conversations or messages
    const channel = supabase
      .channel("messages-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" },
        () => loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!activeConv || !user) return;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConv)
      .order("created_at")
      .then(({ data }) => {
        setMessages(data ?? []);
        if (data && data.length > 0) {
          const unreadIds = data.filter(m => m.sender_id !== user.id && !m.is_read).map(m => m.id);
          if (unreadIds.length > 0) {
            supabase.from("messages").update({ is_read: true }).in("id", unreadIds).then(() => {
              setConversations(prev => prev.map(c => c.id === activeConv ? { ...c, unread_count: 0 } : c));
            });
          }
        }
      });

    const channel = supabase
      .channel(`messages-${activeConv}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConv}` },
        (payload) => {
          const msg = payload.new as any;
          setMessages((prev) => [...prev, msg]);
          // Auto-mark incoming messages as read if from the other person
          if (msg.sender_id !== user.id && !msg.is_read) {
            supabase.from("messages").update({ is_read: true }).eq("id", msg.id).then();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv || !user) return;
    await supabase.from("messages").insert({
      conversation_id: activeConv,
      sender_id: user.id,
      content: newMsg.trim(),
    });
    setNewMsg("");
  };

  const getOtherName = (conv: any) => {
    if (!user) return "";
    if (conv.student_id === user.id) return conv.teacher_name ?? "معلم";
    return conv.student_name ?? "طالب";
  };

  const getConvStatus = (conv: any) => {
    const status = (conv.bookings as any)?.status;
    return status === "completed" ? "completed" : "active";
  };

  const activeConvData = conversations.find(c => c.id === activeConv);
  const bookingStatus = (activeConvData?.bookings as any)?.status;
  const isReadOnly = user && activeConvData?.student_id === user.id && bookingStatus === "completed";

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Conversations list */}
        <div className={`${activeConv ? "hidden md:block" : "block"} w-full md:w-80 border-l border-border`}>
          <div className="p-4">
            <h1 className="text-xl font-bold mb-4">المحادثات</h1>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد محادثات</p>
            ) : (
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConv(c.id)}
                    className={`w-full text-right p-3 rounded-lg transition-colors ${activeConv === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {c.unread_count > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                            {c.unread_count > 99 ? "99+" : c.unread_count}
                          </span>
                        )}
                        <Badge variant={getConvStatus(c) === "active" ? "default" : "secondary"} className="text-[10px]">
                          {getConvStatus(c) === "active" ? "نشط" : "منتهي"}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm">{getOtherName(c)}</p>
                    </div>
                    {c.lesson_title && (
                      <p className="text-xs text-muted-foreground text-right">{c.lesson_title}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className={`${!activeConv ? "hidden md:flex" : "flex"} flex-col flex-1`}>
          {activeConv ? (
            <>
              <div className="p-3 border-b border-border flex items-center">
                <button onClick={() => setActiveConv(null)} className="md:hidden text-sm text-primary ml-3">← رجوع</button>
                <span className="font-semibold text-sm flex-1">
                  {getOtherName(conversations.find((c) => c.id === activeConv))}
                </span>
                {isReadOnly && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">للقراءة فقط</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {!isReadOnly && (
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <Button onClick={sendMessage} size="icon" variant="hero">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              اختر محادثة
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
