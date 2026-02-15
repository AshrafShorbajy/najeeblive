import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, DollarSign, Calendar, CheckCircle, XCircle, MessageCircle, Send, ArrowRight } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function TeacherDashboard() {
  const { user } = useAuthContext();
  const { format, convert, exchangeRate, currency } = useCurrency();
  const [profile, setProfile] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [accountingRecords, setAccountingRecords] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState(20);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [skillCats, setSkillCats] = useState<any[]>([]);

  // New lesson form
  const [newLesson, setNewLesson] = useState({
    title: "", description: "", lesson_type: "tutoring" as string,
    curriculum_id: "", grade_level_id: "", subject_id: "",
    skill_category_id: "", duration_minutes: 60, price: 0,
    min_age: 0, max_age: 0, notes: "",
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [scheduleBookingId, setScheduleBookingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Teacher messages state
  const [teacherConversations, setTeacherConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [teacherNewMsg, setTeacherNewMsg] = useState("");
  const teacherMsgEndRef = useRef<HTMLDivElement>(null);
  const [teacherUnreadCount, setTeacherUnreadCount] = useState(0);

  // Badge counters - track which tabs have been viewed
  const [activeTab, setActiveTab] = useState("lessons");
  const [viewedTabs, setViewedTabs] = useState<Set<string>>(new Set(["lessons"]));
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      setProfile(data);
      setBio(data?.bio || "");
    });
    fetchLessons();
    fetchBookings();
    fetchAccountingRecords();
    fetchCommissionRate();
    supabase.from("curricula").select("*").then(({ data }) => setCurricula(data ?? []));
    supabase.from("skills_categories").select("*").then(({ data }) => setSkillCats(data ?? []));
    supabase.from("withdrawal_requests").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setWithdrawals(data ?? []);
        setPendingWithdrawalsCount((data ?? []).filter(w => w.status === "pending").length);
      });
    fetchTeacherConversations();
    fetchTeacherUnread();
  }, [user]);

  // Mark tab as viewed when switching
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setViewedTabs(prev => new Set(prev).add(tab));
  };

  const fetchTeacherUnread = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("teacher_id", user.id);
    if (!convs || convs.length === 0) { setTeacherUnreadCount(0); return; }
    const convIds = convs.map(c => c.id);
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .eq("is_read", false);
    setTeacherUnreadCount(count ?? 0);
  };

  // Realtime for teacher unread count
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("teacher-unread-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" },
        () => fetchTeacherUnread()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchTeacherConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*, bookings:booking_id(id, status, lessons(title))")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    
    const convs = data ?? [];
    const studentIds = [...new Set(convs.map(c => c.student_id))];
    let nameMap: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds);
      profiles?.forEach(p => { nameMap[p.user_id] = p.full_name; });
    }

    // Fetch unread counts per conversation
    const convIds = convs.map(c => c.id);
    let unreadMap: Record<string, number> = {};
    if (convIds.length > 0) {
      const { data: unreadMsgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);
      unreadMsgs?.forEach(m => {
        unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1;
      });
    }

    setTeacherConversations(convs.map(c => ({
      ...c,
      student_name: nameMap[c.student_id] || "طالب",
      unread_count: unreadMap[c.id] ?? 0,
    })));
  };

  const openTeacherChat = async (convId: string) => {
    setActiveConvId(convId);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at");
    setChatMessages(data ?? []);
    // Mark unread messages as read
    if (data && user) {
      const unreadIds = data.filter(m => m.sender_id !== user.id && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
        fetchTeacherUnread();
        // Update local unread count
        setTeacherConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
      }
    }
  };

  const sendTeacherMessage = async () => {
    if (!teacherNewMsg.trim() || !activeConvId || !user) return;
    await supabase.from("messages").insert({
      conversation_id: activeConvId,
      sender_id: user.id,
      content: teacherNewMsg.trim(),
    });
    setTeacherNewMsg("");
  };

  // Realtime for teacher chat
  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase
      .channel(`teacher-msgs-${activeConvId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvId}` },
        (payload) => setChatMessages(prev => [...prev, payload.new as any])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvId]);

  useEffect(() => {
    teacherMsgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchAccountingRecords = async () => {
    if (!user) return;
    const { data } = await supabase.from("accounting_records").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
    const records = data ?? [];
    setAccountingRecords(records);
    const totalTeacherShare = records.reduce((sum, r) => sum + Number(r.teacher_share), 0);
    setEarnings(totalTeacherShare);
    // Calculate withdrawable balance (earnings - approved withdrawals)
    const { data: approvedW } = await supabase.from("withdrawal_requests")
      .select("amount")
      .eq("teacher_id", user.id)
      .eq("status", "approved");
    const totalWithdrawn = (approvedW ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
    setWithdrawableBalance(totalTeacherShare - totalWithdrawn);
  };

  const fetchCommissionRate = async () => {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "commission_rate").maybeSingle();
    if (data?.value && typeof data.value === "number") {
      setCommissionRate(data.value);
    }
  };

  const fetchLessons = async () => {
    if (!user) return;
    const { data } = await supabase.from("lessons").select("*").eq("teacher_id", user.id);
    setLessons(data ?? []);
  };

  const fetchBookings = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("bookings")
      .select("*, lessons(title)")
      .eq("teacher_id", user.id)
      .in("status", ["accepted", "scheduled", "completed", "cancelled"])
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("خطأ في جلب الطلبات: " + error.message);
      return;
    }

    // Fetch student names from profiles
    const studentIds = [...new Set((data ?? []).map((b) => b.student_id))];
    let studentNames: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles")
        .select("user_id, full_name")
        .in("user_id", studentIds);
      profiles?.forEach((p) => { studentNames[p.user_id] = p.full_name; });
    }

    const enriched = (data ?? []).map((b) => ({
      ...b,
      student_name: studentNames[b.student_id] || "غير معروف",
    }));
    setBookings(enriched);
    setNewBookingsCount(enriched.filter(b => b.status === "accepted").length);
    const completed = enriched.filter((b) => b.status === "completed");
    setEarnings(completed.reduce((sum, b) => sum + Number(b.amount), 0));
  };

  useEffect(() => {
    if (newLesson.curriculum_id) {
      supabase.from("grade_levels").select("*").eq("curriculum_id", newLesson.curriculum_id)
        .then(({ data }) => setGradeLevels(data ?? []));
    }
  }, [newLesson.curriculum_id]);

  useEffect(() => {
    if (newLesson.grade_level_id) {
      supabase.from("subjects").select("*").eq("grade_level_id", newLesson.grade_level_id)
        .then(({ data }) => setSubjects(data ?? []));
    }
  }, [newLesson.grade_level_id]);

  const handleAddLesson = async () => {
    if (!user) return;
    const { error } = await supabase.from("lessons").insert({
      teacher_id: user.id,
      title: newLesson.title,
      description: newLesson.description,
      lesson_type: newLesson.lesson_type as any,
      curriculum_id: newLesson.curriculum_id || null,
      grade_level_id: newLesson.grade_level_id || null,
      subject_id: newLesson.subject_id || null,
      skill_category_id: newLesson.skill_category_id || null,
      duration_minutes: newLesson.duration_minutes,
      price: newLesson.price,
      min_age: newLesson.min_age || null,
      max_age: newLesson.max_age || null,
      notes: newLesson.notes,
    });
    if (error) toast.error("خطأ في إضافة الحصة");
    else {
      toast.success("تمت إضافة الحصة");
      setAddDialogOpen(false);
      fetchLessons();
    }
  };

  const handleEditLesson = (lesson: any) => {
    setEditLesson({
      ...lesson,
      curriculum_id: lesson.curriculum_id || "",
      grade_level_id: lesson.grade_level_id || "",
      subject_id: lesson.subject_id || "",
      skill_category_id: lesson.skill_category_id || "",
    });
    if (lesson.curriculum_id) {
      supabase.from("grade_levels").select("*").eq("curriculum_id", lesson.curriculum_id)
        .then(({ data }) => setGradeLevels(data ?? []));
    }
    if (lesson.grade_level_id) {
      supabase.from("subjects").select("*").eq("grade_level_id", lesson.grade_level_id)
        .then(({ data }) => setSubjects(data ?? []));
    }
    setEditDialogOpen(true);
  };

  const handleSaveEditLesson = async () => {
    if (!editLesson) return;
    const { error } = await supabase.from("lessons").update({
      title: editLesson.title,
      description: editLesson.description,
      lesson_type: editLesson.lesson_type,
      curriculum_id: editLesson.curriculum_id || null,
      grade_level_id: editLesson.grade_level_id || null,
      subject_id: editLesson.subject_id || null,
      skill_category_id: editLesson.skill_category_id || null,
      duration_minutes: editLesson.duration_minutes,
      price: editLesson.price,
      min_age: editLesson.min_age || null,
      max_age: editLesson.max_age || null,
      notes: editLesson.notes,
      is_active: editLesson.is_active,
    }).eq("id", editLesson.id);
    if (error) toast.error("خطأ في تعديل الحصة");
    else {
      toast.success("تم تعديل الحصة");
      setEditDialogOpen(false);
      setEditLesson(null);
      fetchLessons();
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setScheduleBookingId(bookingId);
  };

  const handleScheduleBooking = async () => {
    if (!scheduleBookingId || !scheduleDate) return;
    const booking = bookings.find((b) => b.id === scheduleBookingId);
    if (!booking) return;

    const { data: zoomData, error: zoomError } = await supabase.functions.invoke("create-zoom-meeting", {
      body: {
        topic: (booking as any).lessons?.title ?? "حصة",
        duration: 60,
        start_time: new Date(scheduleDate).toISOString(),
      },
    });

    const updateData: any = {
      status: "scheduled",
      scheduled_at: new Date(scheduleDate).toISOString(),
    };

    if (zoomData && !zoomError) {
      updateData.zoom_meeting_id = String(zoomData.id);
      updateData.zoom_join_url = zoomData.join_url;
      updateData.zoom_start_url = zoomData.start_url;
    }

    const { error } = await supabase.from("bookings").update(updateData).eq("id", scheduleBookingId);
    if (error) toast.error("خطأ في جدولة الحصة");
    else {
      toast.success("تم جدولة الحصة وإنشاء رابط زوم");
      setScheduleBookingId(null);
      setScheduleDate("");
      fetchBookings();
    }
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount) return;
    const amountInDisplayCurrency = parseFloat(withdrawAmount);
    const withdrawableInDisplay = convert(withdrawableBalance);
    if (amountInDisplayCurrency > withdrawableInDisplay) {
      toast.error("المبلغ المطلوب أكبر من الرصيد القابل للسحب");
      return;
    }
    const amountInUsd = exchangeRate > 0 ? amountInDisplayCurrency / exchangeRate : amountInDisplayCurrency;
    const { error } = await supabase.from("withdrawal_requests").insert({
      teacher_id: user.id,
      amount: Math.round(amountInUsd * 100) / 100,
    });
    if (error) toast.error("خطأ"); else {
      toast.success("تم إرسال طلب السحب");
      setWithdrawAmount("");
      const { data } = await supabase.from("withdrawal_requests").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
      setWithdrawals(data ?? []);
      setPendingWithdrawalsCount((data ?? []).filter(w => w.status === "pending").length);
      fetchAccountingRecords();
    }
  };

  const TabBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;
    return (
      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">لوحة تحكم المعلم</h1>

        <Tabs defaultValue="lessons" value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="profile" className="flex-1">المعلومات</TabsTrigger>
            <TabsTrigger value="lessons" className="flex-1">الحصص</TabsTrigger>
            <TabsTrigger value="bookings" className="flex-1 relative overflow-visible">
              الطلبات
              {!viewedTabs.has("bookings") && newBookingsCount > 0 && <TabBadge count={newBookingsCount} />}
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-1 relative overflow-visible">
              الرسائل
              {!viewedTabs.has("messages") && teacherUnreadCount > 0 && <TabBadge count={teacherUnreadCount} />}
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex-1">الأرباح</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <p className="text-sm"><strong>الاسم:</strong> {profile?.full_name}</p>
              <p className="text-sm"><strong>الهاتف:</strong> {profile?.phone ?? "غير محدد"}</p>
              <p className="text-sm"><strong>البريد:</strong> {user?.email}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <Label className="font-semibold">نبذة عنك (بايو)</Label>
              <Textarea
                placeholder="اكتب نبذة مختصرة عن نفسك وخبراتك..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
              <Button
                variant="hero"
                className="w-full"
                disabled={savingBio}
                onClick={async () => {
                  if (!user) return;
                  setSavingBio(true);
                  const { error } = await supabase.from("profiles").update({ bio }).eq("user_id", user.id);
                  if (error) toast.error("خطأ في حفظ البايو");
                  else toast.success("تم حفظ البايو بنجاح");
                  setSavingBio(false);
                }}
              >
                {savingBio ? "جارٍ الحفظ..." : "حفظ البايو"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="lessons" className="mt-4">
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" className="mb-4 w-full">
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة حصة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>إضافة حصة</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>عنوان الحصة</Label><Input value={newLesson.title} onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })} /></div>
                  <div><Label>الوصف</Label><Textarea value={newLesson.description} onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })} /></div>
                  <div><Label>نوع الحصة</Label>
                    <Select value={newLesson.lesson_type} onValueChange={(v) => setNewLesson({ ...newLesson, lesson_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tutoring">تقوية ومراجعة</SelectItem>
                        <SelectItem value="bag_review">مراجعة الشنطة</SelectItem>
                        <SelectItem value="skills">مهارات ومواهب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newLesson.lesson_type !== "skills" && (
                    <>
                      <div><Label>المنهج</Label>
                        <Select value={newLesson.curriculum_id} onValueChange={(v) => setNewLesson({ ...newLesson, curriculum_id: v, grade_level_id: "", subject_id: "" })}>
                          <SelectTrigger><SelectValue placeholder="اختر المنهج" /></SelectTrigger>
                          <SelectContent>{curricula.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>المرحلة</Label>
                        <Select value={newLesson.grade_level_id} onValueChange={(v) => setNewLesson({ ...newLesson, grade_level_id: v, subject_id: "" })}>
                          <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                          <SelectContent>{gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {newLesson.lesson_type === "tutoring" && (
                        <div><Label>المادة</Label>
                          <Select value={newLesson.subject_id} onValueChange={(v) => setNewLesson({ ...newLesson, subject_id: v })}>
                            <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                  {newLesson.lesson_type === "skills" && (
                    <div><Label>نوع الموهبة</Label>
                      <Select value={newLesson.skill_category_id} onValueChange={(v) => setNewLesson({ ...newLesson, skill_category_id: v })}>
                        <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                        <SelectContent>{skillCats.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>المدة (دقيقة)</Label><Input type="number" value={newLesson.duration_minutes} onChange={(e) => setNewLesson({ ...newLesson, duration_minutes: parseInt(e.target.value) || 60 })} /></div>
                    <div><Label>السعر ($)</Label><Input type="number" value={newLesson.price} onChange={(e) => setNewLesson({ ...newLesson, price: parseFloat(e.target.value) || 0 })} /></div>
                  </div>
                  <div><Label>ملاحظات</Label><Textarea value={newLesson.notes} onChange={(e) => setNewLesson({ ...newLesson, notes: e.target.value })} /></div>
                  <Button onClick={handleAddLesson} variant="hero" className="w-full">إضافة الحصة</Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-3">
              {lessons.map((l) => (
                <div key={l.id} className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{l.title}</h3>
                        <p className="text-xs text-muted-foreground">{l.duration_minutes} دقيقة • {format(l.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEditLesson(l)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <span className={`text-xs px-2 py-1 rounded-full ${l.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {l.is_active ? "نشط" : "غير نشط"}
                        </span>
                      </div>
                    </div>
                </div>
              ))}
            </div>
            {/* Edit Lesson Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>تعديل الحصة</DialogTitle></DialogHeader>
                {editLesson && (
                  <div className="space-y-3">
                    <div><Label>عنوان الحصة</Label><Input value={editLesson.title} onChange={(e) => setEditLesson({ ...editLesson, title: e.target.value })} /></div>
                    <div><Label>الوصف</Label><Textarea value={editLesson.description || ""} onChange={(e) => setEditLesson({ ...editLesson, description: e.target.value })} /></div>
                    <div><Label>نوع الحصة</Label>
                      <Select value={editLesson.lesson_type} onValueChange={(v) => setEditLesson({ ...editLesson, lesson_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tutoring">تقوية ومراجعة</SelectItem>
                          <SelectItem value="bag_review">مراجعة الشنطة</SelectItem>
                          <SelectItem value="skills">مهارات ومواهب</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editLesson.lesson_type !== "skills" && (
                      <>
                        <div><Label>المنهج</Label>
                          <Select value={editLesson.curriculum_id} onValueChange={(v) => {
                            setEditLesson({ ...editLesson, curriculum_id: v, grade_level_id: "", subject_id: "" });
                            supabase.from("grade_levels").select("*").eq("curriculum_id", v).then(({ data }) => setGradeLevels(data ?? []));
                          }}>
                            <SelectTrigger><SelectValue placeholder="اختر المنهج" /></SelectTrigger>
                            <SelectContent>{curricula.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>المرحلة</Label>
                          <Select value={editLesson.grade_level_id} onValueChange={(v) => {
                            setEditLesson({ ...editLesson, grade_level_id: v, subject_id: "" });
                            supabase.from("subjects").select("*").eq("grade_level_id", v).then(({ data }) => setSubjects(data ?? []));
                          }}>
                            <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                            <SelectContent>{gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {editLesson.lesson_type === "tutoring" && (
                          <div><Label>المادة</Label>
                            <Select value={editLesson.subject_id} onValueChange={(v) => setEditLesson({ ...editLesson, subject_id: v })}>
                              <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                    {editLesson.lesson_type === "skills" && (
                      <div><Label>نوع الموهبة</Label>
                        <Select value={editLesson.skill_category_id} onValueChange={(v) => setEditLesson({ ...editLesson, skill_category_id: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                          <SelectContent>{skillCats.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>المدة (دقيقة)</Label><Input type="number" value={editLesson.duration_minutes} onChange={(e) => setEditLesson({ ...editLesson, duration_minutes: parseInt(e.target.value) || 60 })} /></div>
                      <div><Label>السعر ($)</Label><Input type="number" value={editLesson.price} onChange={(e) => setEditLesson({ ...editLesson, price: parseFloat(e.target.value) || 0 })} /></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>نشط</Label>
                      <input type="checkbox" checked={editLesson.is_active} onChange={(e) => setEditLesson({ ...editLesson, is_active: e.target.checked })} />
                    </div>
                    <div><Label>ملاحظات</Label><Textarea value={editLesson.notes || ""} onChange={(e) => setEditLesson({ ...editLesson, notes: e.target.value })} /></div>
                    <Button onClick={handleSaveEditLesson} variant="hero" className="w-full">حفظ التعديلات</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="bookings" className="mt-4 space-y-3">
            {bookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">لا توجد طلبات حتى الآن</p>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{(b as any).lessons?.title}</h3>
                      <p className="text-xs text-muted-foreground">الطالب: {b.student_name}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {b.status === "accepted" ? "جديد - بانتظار القبول" : b.status === "scheduled" ? "مجدول" : b.status === "completed" ? "مكتمل" : b.status === "cancelled" ? "ملغي" : b.status}
                    </span>
                  </div>
                  {b.status === "accepted" && (
                    <Button size="sm" variant="hero" onClick={() => handleAcceptBooking(b.id)} className="w-full">
                      <CheckCircle className="h-4 w-4 ml-1" />
                      قبول وجدولة
                    </Button>
                  )}
                  {scheduleBookingId === b.id && (
                    <div className="mt-3 space-y-2">
                      <Label>اختر موعد الحصة</Label>
                      <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} dir="ltr" />
                      <Button onClick={handleScheduleBooking} size="sm" className="w-full">تأكيد الموعد</Button>
                    </div>
                  )}
                  {b.scheduled_at && (
                    <p className="text-xs text-muted-foreground mt-2">الموعد: {new Date(b.scheduled_at).toLocaleString("ar")}</p>
                  )}
                  {b.zoom_start_url && b.status === "scheduled" && (
                    <a href={b.zoom_start_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="accent" className="w-full mt-2">بدء الحصة (زوم)</Button>
                    </a>
                  )}
                  {b.status === "scheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 text-success border-success/30 hover:bg-success/10"
                      onClick={async () => {
                        const { error } = await supabase.from("bookings").update({
                          status: "completed",
                          zoom_join_url: null,
                          zoom_start_url: null,
                          zoom_meeting_id: null,
                        }).eq("id", b.id);
                        if (error) {
                          toast.error("خطأ في تحديث الحالة");
                        } else {
                          const totalAmount = Number(b.amount);
                          const platformShare = Math.round(totalAmount * commissionRate) / 100;
                          const teacherShare = totalAmount - platformShare;
                          await supabase.from("accounting_records").insert({
                            booking_id: b.id,
                            lesson_id: b.lesson_id,
                            teacher_id: b.teacher_id,
                            student_id: b.student_id,
                            total_amount: totalAmount,
                            commission_rate: commissionRate,
                            platform_share: platformShare,
                            teacher_share: teacherShare,
                          });
                          toast.success("تم إنهاء الحصة وتسجيل الأرباح");
                          fetchBookings();
                          fetchAccountingRecords();
                        }
                      }}
                    >
                      <CheckCircle className="h-4 w-4 ml-1" />
                      إنهاء الحصة
                    </Button>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            {activeConvId ? (
              <div className="flex flex-col h-[60vh] bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <button onClick={() => { setActiveConvId(null); setChatMessages([]); }} className="text-sm text-primary flex items-center gap-1">
                    <ArrowRight className="h-4 w-4" />
                    رجوع
                  </button>
                  <span className="font-semibold text-sm flex-1">
                    {(() => {
                      const conv = teacherConversations.find(c => c.id === activeConvId);
                      return `${conv?.student_name} - ${(conv?.bookings as any)?.lessons?.title ?? "حصة"}`;
                    })()}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {chatMessages.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">لا توجد رسائل بعد</p>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={teacherMsgEndRef} />
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    value={teacherNewMsg}
                    onChange={(e) => setTeacherNewMsg(e.target.value)}
                    placeholder="اكتب ردك..."
                    onKeyDown={(e) => e.key === "Enter" && sendTeacherMessage()}
                  />
                  <Button onClick={sendTeacherMessage} size="icon" variant="hero">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {teacherConversations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">لا توجد رسائل حتى الآن</p>
                ) : (
                  teacherConversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openTeacherChat(c.id)}
                      className="w-full text-right bg-card rounded-xl p-4 border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {c.unread_count > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </span>
                          )}
                          <MessageCircle className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{c.student_name}</p>
                          <p className="text-xs text-muted-foreground">{(c.bookings as any)?.lessons?.title ?? "حصة"}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="earnings" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 border border-border text-center">
                <DollarSign className="h-6 w-6 mx-auto text-success mb-1" />
                <p className="text-xl font-bold">{format(earnings)}</p>
                <p className="text-[10px] text-muted-foreground">إجمالي الأرباح من المنصة</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border text-center">
                <DollarSign className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{format(withdrawableBalance)}</p>
                <p className="text-[10px] text-muted-foreground">رصيد الأرباح القابل للسحب</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground text-center">
              نسبة عمولة المنصة: {commissionRate}% — يتم خصمها تلقائياً عند إتمام كل حصة
            </div>

            {accountingRecords.length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <h3 className="font-semibold text-sm">سجل الأرباح</h3>
                <div className="space-y-2">
                  {accountingRecords.slice(0, 15).map(r => (
                    <div key={r.id} className="border border-border rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                        <span className="font-medium">المبلغ: {format(r.total_amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">العمولة ({r.commission_rate}%): {format(r.platform_share)}</span>
                        <span className="font-bold text-success">صافي: {format(r.teacher_share)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <h3 className="font-semibold">طلب سحب</h3>
              <Input type="number" placeholder={`المبلغ بـ ${currency.symbol}`} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              <Button onClick={handleWithdraw} variant="hero" className="w-full">طلب سحب</Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">طلبات السحب السابقة</h3>
              {withdrawals.map((w) => (
                <div key={w.id} className="p-3 rounded-lg border border-border flex justify-between items-center">
                  <span className="font-medium">{format(w.amount)}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${w.status === "approved" ? "bg-success/10 text-success" : w.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                    {w.status === "pending" ? "قيد المراجعة" : w.status === "approved" ? "مقبول" : "مرفوض"}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
