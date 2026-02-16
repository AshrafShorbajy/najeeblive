import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Users, CalendarDays, Video, CheckCircle, Upload, PlayCircle, Loader2, ArrowRight } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface GroupCoursesTabProps {
  userId: string;
  onCoursesChange?: () => void;
}

const emptyForm = {
  title: "", description: "", curriculum_id: "", grade_level_id: "", subject_id: "",
  duration_minutes: 60, price: 0, min_age: 0, max_age: 0, notes: "",
  expected_students: 3, total_sessions: 5, course_start_date: "",
  course_topic_type: "", session_dates: [] as string[],
};

export default function GroupCoursesTab({ userId, onCoursesChange }: GroupCoursesTabProps) {
  const { format } = useCurrency();
  const [courses, setCourses] = useState<any[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [newCourse, setNewCourse] = useState({ ...emptyForm });
  const [addOpen, setAddOpen] = useState(false);

  const [editCourse, setEditCourse] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSessionDates, setEditSessionDates] = useState<{ id?: string; session_number: number; scheduled_at: string }[]>([]);

  // Session management state
  const [managingCourse, setManagingCourse] = useState<any>(null);
  const [courseSessions, setCourseSessions] = useState<any[]>([]);
  const [uploadingSessionId, setUploadingSessionId] = useState<string | null>(null);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
    supabase.from("curricula").select("*").then(({ data }) => setCurricula(data ?? []));
  }, [userId]);

  useEffect(() => {
    if (newCourse.curriculum_id) {
      supabase.from("grade_levels").select("*").eq("curriculum_id", newCourse.curriculum_id)
        .then(({ data }) => setGradeLevels(data ?? []));
    }
  }, [newCourse.curriculum_id]);

  useEffect(() => {
    if (newCourse.grade_level_id) {
      supabase.from("subjects").select("*").eq("grade_level_id", newCourse.grade_level_id)
        .then(({ data }) => setSubjects(data ?? []));
    }
  }, [newCourse.grade_level_id]);

  const fetchCourses = async () => {
    const { data } = await supabase.from("lessons").select("*")
      .eq("teacher_id", userId).eq("lesson_type", "group")
      .order("created_at", { ascending: false });
    setCourses(data ?? []);
  };

  const handleAdd = async () => {
    if (!newCourse.course_start_date) { toast.error("يجب تحديد موعد بداية الكورس"); return; }
    if (newCourse.total_sessions < 5) { toast.error("يجب أن يكون عدد الحصص 5 على الأقل"); return; }
    const filledDates = newCourse.session_dates.filter(d => d.trim() !== "");
    if (filledDates.length < 5) { toast.error("يجب إدخال 5 مواعيد حصص على الأقل لتفعيل الكورس"); return; }

    const { data: lessonData, error } = await supabase.from("lessons").insert({
      teacher_id: userId,
      title: newCourse.title,
      description: newCourse.description,
      lesson_type: "group" as any,
      curriculum_id: newCourse.curriculum_id || null,
      grade_level_id: newCourse.grade_level_id || null,
      subject_id: newCourse.subject_id || null,
      duration_minutes: newCourse.duration_minutes,
      price: newCourse.price,
      min_age: newCourse.min_age || null,
      max_age: newCourse.max_age || null,
      notes: newCourse.notes,
      expected_students: newCourse.expected_students,
      total_sessions: newCourse.total_sessions,
      course_start_date: new Date(newCourse.course_start_date).toISOString(),
      course_topic_type: newCourse.course_topic_type,
    }).select().single();

    if (error || !lessonData) { toast.error("خطأ في إضافة الكورس"); return; }

    const schedules = newCourse.session_dates.map((date, i) => ({
      lesson_id: lessonData.id,
      session_number: i + 1,
      scheduled_at: date ? new Date(date).toISOString() : null,
    }));
    await supabase.from("group_session_schedules").insert(schedules);

    toast.success("تمت إضافة الكورس الجماعي");
    setAddOpen(false);
    setNewCourse({ ...emptyForm });
    fetchCourses();
    onCoursesChange?.();
  };

  const openEdit = async (course: any) => {
    setEditCourse({
      ...course,
      curriculum_id: course.curriculum_id || "",
      grade_level_id: course.grade_level_id || "",
      subject_id: course.subject_id || "",
      course_start_date: course.course_start_date ? new Date(course.course_start_date).toISOString().slice(0, 16) : "",
    });

    if (course.curriculum_id) {
      supabase.from("grade_levels").select("*").eq("curriculum_id", course.curriculum_id)
        .then(({ data }) => setGradeLevels(data ?? []));
    }
    if (course.grade_level_id) {
      supabase.from("subjects").select("*").eq("grade_level_id", course.grade_level_id)
        .then(({ data }) => setSubjects(data ?? []));
    }

    const { data: schedules } = await supabase.from("group_session_schedules")
      .select("*").eq("lesson_id", course.id).order("session_number");

    const totalSessions = course.total_sessions || 5;
    const existingSchedules = schedules ?? [];
    const dates: typeof editSessionDates = [];
    for (let i = 0; i < totalSessions; i++) {
      const existing = existingSchedules.find(s => s.session_number === i + 1);
      dates.push({
        id: existing?.id,
        session_number: i + 1,
        scheduled_at: existing?.scheduled_at ? new Date(existing.scheduled_at).toISOString().slice(0, 16) : "",
      });
    }
    setEditSessionDates(dates);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editCourse) return;

    const { error } = await supabase.from("lessons").update({
      title: editCourse.title,
      description: editCourse.description,
      curriculum_id: editCourse.curriculum_id || null,
      grade_level_id: editCourse.grade_level_id || null,
      subject_id: editCourse.subject_id || null,
      duration_minutes: editCourse.duration_minutes,
      price: editCourse.price,
      min_age: editCourse.min_age || null,
      max_age: editCourse.max_age || null,
      notes: editCourse.notes,
      is_active: editCourse.is_active,
      expected_students: editCourse.expected_students,
      total_sessions: editCourse.total_sessions,
      course_start_date: editCourse.course_start_date ? new Date(editCourse.course_start_date).toISOString() : null,
      course_topic_type: editCourse.course_topic_type,
    }).eq("id", editCourse.id);

    if (error) { toast.error("خطأ في تعديل الكورس"); return; }

    for (const sd of editSessionDates) {
      if (sd.id) {
        await supabase.from("group_session_schedules").update({
          scheduled_at: sd.scheduled_at ? new Date(sd.scheduled_at).toISOString() : null,
        }).eq("id", sd.id);
      } else if (sd.scheduled_at) {
        await supabase.from("group_session_schedules").insert({
          lesson_id: editCourse.id,
          session_number: sd.session_number,
          scheduled_at: new Date(sd.scheduled_at).toISOString(),
        });
      }
    }

    toast.success("تم تعديل الكورس بنجاح");
    setEditOpen(false);
    setEditCourse(null);
    fetchCourses();
    onCoursesChange?.();
  };

  // Session management functions
  const openManageSessions = async (course: any) => {
    setManagingCourse(course);
    const { data } = await supabase.from("group_session_schedules")
      .select("*").eq("lesson_id", course.id).order("session_number");
    setCourseSessions(data ?? []);
  };

  const handleStartSession = async (session: any) => {
    setStartingSessionId(session.id);
    try {
      const { data: zoomData, error: zoomError } = await supabase.functions.invoke("create-zoom-meeting", {
        body: {
          topic: `${managingCourse?.title} - حصة ${session.session_number}`,
          duration: managingCourse?.duration_minutes || 60,
          start_time: session.scheduled_at || new Date().toISOString(),
        },
      });

      const updateData: Record<string, any> = { status: "active" };
      if (zoomData && !zoomError) {
        updateData.zoom_meeting_id = String(zoomData.id);
        updateData.zoom_join_url = zoomData.join_url;
        updateData.zoom_start_url = zoomData.start_url;
      }

      await supabase.from("group_session_schedules").update(updateData as any).eq("id", session.id);
      toast.success("تم بدء الحصة وإنشاء رابط زوم");
      openManageSessions(managingCourse);
    } catch (err) {
      toast.error("خطأ في بدء الحصة");
    } finally {
      setStartingSessionId(null);
    }
  };

  const handleEndSession = async (session: any) => {
    await supabase.from("group_session_schedules").update({
      status: "completed",
      zoom_join_url: null,
      zoom_start_url: null,
      zoom_meeting_id: null,
    } as any).eq("id", session.id);
    toast.success("تم إنهاء الحصة");
    openManageSessions(managingCourse);
  };

  const handleUploadSessionRecording = async (session: any) => {
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
      setUploadingSessionId(session.id);
      try {
        const ext = file.name.split(".").pop();
        const path = `${userId}/${managingCourse.id}_session_${session.session_number}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("recordings").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(path);
        await supabase.from("group_session_schedules").update({ recording_url: urlData.publicUrl } as any).eq("id", session.id);
        toast.success("تم رفع التسجيل بنجاح");
        openManageSessions(managingCourse);
      } catch {
        toast.error("خطأ في رفع التسجيل");
      } finally {
        setUploadingSessionId(null);
      }
    };
    input.click();
  };

  const sessionStatusLabel = (s: string) => {
    const map: Record<string, string> = { pending: "لم تبدأ", active: "جارية", completed: "منتهية" };
    return map[s] ?? s;
  };
  const sessionStatusColor = (s: string) => {
    const map: Record<string, string> = { pending: "bg-muted text-muted-foreground", active: "bg-primary/10 text-primary", completed: "bg-success/10 text-success" };
    return map[s] ?? "";
  };

  // Session management view
  if (managingCourse) {
    return (
      <div>
        <button onClick={() => setManagingCourse(null)} className="text-sm text-primary flex items-center gap-1 mb-4">
          <ArrowRight className="h-4 w-4" />
          رجوع للكورسات
        </button>
        <h2 className="text-lg font-bold mb-2">{managingCourse.title}</h2>
        <p className="text-xs text-muted-foreground mb-4">إدارة حصص الكورس - {courseSessions.length} حصة</p>
        
        <div className="space-y-3">
          {courseSessions.filter(s => s.scheduled_at).map((session) => (
            <div key={session.id} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">حصة {session.session_number}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(session.scheduled_at).toLocaleString("ar")}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${sessionStatusColor(session.status)}`}>
                  {sessionStatusLabel(session.status)}
                </span>
              </div>

              {/* Start session */}
              {session.status === "pending" && (
                <Button size="sm" variant="hero" className="w-full mb-2"
                  disabled={startingSessionId === session.id}
                  onClick={() => handleStartSession(session)}>
                  {startingSessionId === session.id ? (
                    <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري إنشاء الرابط...</>
                  ) : (
                    <><Video className="h-4 w-4 ml-2" />بدء الحصة (إنشاء رابط زوم)</>
                  )}
                </Button>
              )}

              {/* Active session - show zoom link and end button */}
              {session.status === "active" && (
                <>
                  {session.zoom_start_url && (
                    <a href={session.zoom_start_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="hero" className="w-full mb-2">
                        <Video className="h-4 w-4 ml-2" />
                        دخول الحصة (زوم)
                      </Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" className="w-full mb-2 text-success border-success/30 hover:bg-success/10"
                    onClick={() => handleEndSession(session)}>
                    <CheckCircle className="h-4 w-4 ml-2" />
                    إنهاء الحصة
                  </Button>
                </>
              )}

              {/* Completed - upload recording or show status */}
              {session.status === "completed" && !session.recording_url && (
                <Button size="sm" variant="outline" className="w-full mb-2 text-primary border-primary/30 hover:bg-primary/10"
                  onClick={() => handleUploadSessionRecording(session)}
                  disabled={uploadingSessionId === session.id}>
                  {uploadingSessionId === session.id ? (
                    <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الرفع...</>
                  ) : (
                    <><Upload className="h-4 w-4 ml-2" />رفع تسجيل الحصة</>
                  )}
                </Button>
              )}

              {session.status === "completed" && session.recording_url && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>تم رفع التسجيل</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const CourseFormFields = ({ form, setForm, isEdit }: { form: any; setForm: (f: any) => void; isEdit?: boolean }) => (
    <div className="space-y-3">
      <div><Label>عنوان الكورس</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label>الوصف</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

      <div><Label>المنهج</Label>
        <Select value={form.curriculum_id} onValueChange={(v) => {
          setForm({ ...form, curriculum_id: v, grade_level_id: "", subject_id: "" });
          supabase.from("grade_levels").select("*").eq("curriculum_id", v).then(({ data }) => setGradeLevels(data ?? []));
        }}>
          <SelectTrigger><SelectValue placeholder="اختر المنهج" /></SelectTrigger>
          <SelectContent>{curricula.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>المرحلة</Label>
        <Select value={form.grade_level_id} onValueChange={(v) => {
          setForm({ ...form, grade_level_id: v, subject_id: "" });
          supabase.from("subjects").select("*").eq("grade_level_id", v).then(({ data }) => setSubjects(data ?? []));
        }}>
          <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
          <SelectContent>{gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>المادة</Label>
        <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
          <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
          <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>المدة (دقيقة)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })} /></div>
        <div><Label>السعر ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></div>
      </div>
      <div><Label>ملاحظات</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

      <div className="border border-primary/20 rounded-lg p-3 space-y-3 bg-primary/5">
        <h4 className="font-semibold text-sm text-primary">إعدادات الكورس الجماعي</h4>
        <div><Label>عدد الطلاب المتوقع</Label>
          <Select value={String(form.expected_students || 3)} onValueChange={(v) => setForm({ ...form, expected_students: parseInt(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 طلاب</SelectItem>
              <SelectItem value="7">7 طلاب</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>نوع الكورس</Label>
          <Select value={form.course_topic_type || ""} onValueChange={(v) => setForm({ ...form, course_topic_type: v })}>
            <SelectTrigger><SelectValue placeholder="اختر نوع الكورس" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="موضوع محدد">موضوع محدد في المنهج</SelectItem>
              <SelectItem value="المنهج كامل">المنهج كامل</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>موعد بداية الكورس</Label>
          <Input type="datetime-local" value={form.course_start_date || ""} onChange={(e) => setForm({ ...form, course_start_date: e.target.value })} dir="ltr" />
        </div>
        <div><Label>عدد الحصص المقررة (5 كحد أدنى)</Label>
          <Input type="number" min={5} value={form.total_sessions || 5} onChange={(e) => {
            const val = Math.max(5, parseInt(e.target.value) || 5);
            if (!isEdit) {
              const dates = [...(form.session_dates || [])];
              while (dates.length < val) dates.push("");
              setForm({ ...form, total_sessions: val, session_dates: dates.slice(0, val) });
            } else {
              setForm({ ...form, total_sessions: val });
              setEditSessionDates(prev => {
                const newDates = [...prev];
                while (newDates.length < val) newDates.push({ session_number: newDates.length + 1, scheduled_at: "" });
                return newDates.slice(0, val);
              });
            }
          }} />
        </div>

        {isEdit && editCourse && (
          <div className="flex items-center gap-2">
            <Label>نشط</Label>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button variant="hero" className="mb-4 w-full">
            <Plus className="h-4 w-4 ml-2" />
            إضافة كورس جماعي جديد
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة كورس جماعي</DialogTitle></DialogHeader>
          <CourseFormFields form={newCourse} setForm={setNewCourse} />
          <div className="space-y-2 mt-2">
            <Label>مواعيد الحصص (أدخل 5 مواعيد على الأقل)</Label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {Array.from({ length: newCourse.total_sessions }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground min-w-[50px]">حصة {i + 1}</span>
                  <Input
                    type="datetime-local" dir="ltr"
                    value={newCourse.session_dates[i] || ""}
                    onChange={(e) => {
                      const dates = [...newCourse.session_dates];
                      while (dates.length <= i) dates.push("");
                      dates[i] = e.target.value;
                      setNewCourse({ ...newCourse, session_dates: dates });
                    }}
                    className="text-xs"
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">* يمكنك إضافة بقية المواعيد لاحقاً بعد بدء الكورس</p>
          </div>
          <Button onClick={handleAdd} variant="hero" className="w-full mt-2">إضافة الكورس</Button>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تعديل الكورس الجماعي</DialogTitle></DialogHeader>
          {editCourse && (
            <>
              <CourseFormFields form={editCourse} setForm={setEditCourse} isEdit />
              <div className="space-y-2 mt-2">
                <Label>مواعيد الحصص</Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {editSessionDates.map((sd, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground min-w-[50px]">حصة {sd.session_number}</span>
                      <Input
                        type="datetime-local" dir="ltr"
                        value={sd.scheduled_at}
                        onChange={(e) => {
                          const dates = [...editSessionDates];
                          dates[i] = { ...dates[i], scheduled_at: e.target.value };
                          setEditSessionDates(dates);
                        }}
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleSaveEdit} variant="hero" className="w-full mt-2">حفظ التعديلات</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Courses List */}
      <div className="space-y-3">
        {courses.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد كورسات جماعية</p>
        ) : (
          courses.map((c) => (
            <div key={c.id} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">{c.duration_minutes} دقيقة • {format(c.price)}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.expected_students} طلاب</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{c.total_sessions} حصة</span>
                    {c.course_start_date && (
                      <span>بداية: {new Date(c.course_start_date).toLocaleDateString("ar")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {c.is_active ? "نشط" : "غير نشط"}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-3 text-primary border-primary/30 hover:bg-primary/10"
                onClick={() => openManageSessions(c)}>
                <CalendarDays className="h-4 w-4 ml-2" />
                إدارة حصص الكورس
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
