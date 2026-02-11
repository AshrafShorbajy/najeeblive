import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function MessagesPage() {
  const { user } = useAuthContext();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("*, student:student_id(full_name), teacher:teacher_id(full_name)")
      .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
      .then(({ data }) => setConversations(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!activeConv) return;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConv)
      .order("created_at")
      .then(({ data }) => setMessages(data ?? []));

    const channel = supabase
      .channel(`messages-${activeConv}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConv}` },
        (payload) => setMessages((prev) => [...prev, payload.new as any])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv]);

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
    if (conv.student_id === user.id) return (conv as any).teacher?.full_name ?? "معلم";
    return (conv as any).student?.full_name ?? "طالب";
  };

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
                    <p className="font-medium text-sm">{getOtherName(c)}</p>
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
                <span className="font-semibold text-sm">
                  {getOtherName(conversations.find((c) => c.id === activeConv))}
                </span>
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
