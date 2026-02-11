import { useEffect, useState } from "react";
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
import { Plus, Edit, DollarSign, Calendar, CheckCircle, XCircle } from "lucide-react";

export default function TeacherDashboard() {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [earnings, setEarnings] = useState(0);
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
  const [scheduleBookingId, setScheduleBookingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => setProfile(data));
    fetchLessons();
    fetchBookings();
    supabase.from("curricula").select("*").then(({ data }) => setCurricula(data ?? []));
    supabase.from("skills_categories").select("*").then(({ data }) => setSkillCats(data ?? []));
    supabase.from("withdrawal_requests").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setWithdrawals(data ?? []));
  }, [user]);

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
      .order("created_at", { ascending: false });
    
    console.log("Bookings fetch result:", { data, error, userId: user.id });
    
    if (error) {
      console.error("Bookings fetch error:", error);
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

  const handleAcceptBooking = async (bookingId: string) => {
    setScheduleBookingId(bookingId);
  };

  const handleScheduleBooking = async () => {
    if (!scheduleBookingId || !scheduleDate) return;
    const booking = bookings.find((b) => b.id === scheduleBookingId);
    if (!booking) return;

    // Call Zoom edge function to create meeting
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
    const { error } = await supabase.from("withdrawal_requests").insert({
      teacher_id: user.id,
      amount: parseFloat(withdrawAmount),
    });
    if (error) toast.error("خطأ"); else {
      toast.success("تم إرسال طلب السحب");
      setWithdrawAmount("");
      const { data } = await supabase.from("withdrawal_requests").select("*").eq("teacher_id", user.id);
      setWithdrawals(data ?? []);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">لوحة تحكم المعلم</h1>

        <Tabs defaultValue="lessons">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="profile" className="flex-1">المعلومات</TabsTrigger>
            <TabsTrigger value="lessons" className="flex-1">الحصص</TabsTrigger>
            <TabsTrigger value="bookings" className="flex-1">الطلبات</TabsTrigger>
            <TabsTrigger value="earnings" className="flex-1">الأرباح</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <p className="text-sm"><strong>الاسم:</strong> {profile?.full_name}</p>
              <p className="text-sm"><strong>الهاتف:</strong> {profile?.phone ?? "غير محدد"}</p>
              <p className="text-sm"><strong>البريد:</strong> {user?.email}</p>
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
                    <div><Label>السعر (ر.س)</Label><Input type="number" value={newLesson.price} onChange={(e) => setNewLesson({ ...newLesson, price: parseFloat(e.target.value) || 0 })} /></div>
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
                      <p className="text-xs text-muted-foreground">{l.duration_minutes} دقيقة • {l.price} ر.س</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${l.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {l.is_active ? "نشط" : "غير نشط"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
                      {b.status === "pending" ? "في الانتظار" : b.status === "scheduled" ? "مجدول" : b.status === "completed" ? "مكتمل" : b.status}
                    </span>
                  </div>
                  {b.status === "pending" && (
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
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="earnings" className="mt-4 space-y-4">
            <div className="bg-card rounded-xl p-6 border border-border text-center">
              <DollarSign className="h-8 w-8 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold">{earnings.toFixed(2)} ر.س</p>
              <p className="text-sm text-muted-foreground">إجمالي الأرباح</p>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <h3 className="font-semibold">طلب سحب</h3>
              <Input type="number" placeholder="المبلغ" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              <Button onClick={handleWithdraw} variant="hero" className="w-full">طلب سحب</Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">طلبات السحب السابقة</h3>
              {withdrawals.map((w) => (
                <div key={w.id} className="p-3 rounded-lg border border-border flex justify-between items-center">
                  <span className="font-medium">{w.amount} ر.س</span>
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
