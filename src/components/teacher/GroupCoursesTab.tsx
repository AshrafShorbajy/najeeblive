import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Edit, Users, CalendarDays, Video, CheckCircle, Upload, Loader2, ArrowRight, Trash2, PlayCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { validateScheduleSlot } from "@/lib/scheduleValidation";

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
  const [enrolledCounts, setEnrolledCounts] = useState<Record<string, number>>({});
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
  const [enrolledInManaging, setEnrolledInManaging] = useState(0);
  const [uploadingSessionId, setUploadingSessionId] = useState<string | null>(null);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionDate, setEditingSessionDate] = useState("");
  const [editingSessionTitle, setEditingSessionTitle] = useState("");

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

    // Fetch enrolled counts for all courses
    if (data && data.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(data.map(async (c) => {
        const { count } = await supabase.from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("lesson_id", c.id)
          .in("status", ["pending", "accepted", "scheduled"]);
        counts[c.id] = count ?? 0;
      }));
      setEnrolledCounts(counts);
    }
  };

  const handleAdd = async () => {
    if (newCourse.total_sessions < 5) { toast.error("يجب أن يكون عدد الحصص 5 على الأقل"); return; }
    const filledDates = newCourse.session_dates.filter(d => d.trim() !== "");
    if (filledDates.length < 5) { toast.error("يجب إدخال 5 مواعيد حصص على الأقل لتفعيل الكورس"); return; }

    // Auto-set course_start_date from earliest session date
    const sortedDates = filledDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
    const courseStartDate = sortedDates[0].toISOString();

    // Validate each session date for past dates and overlaps
    for (let i = 0; i < filledDates.length; i++) {
      const dt = new Date(filledDates[i]);
      const validationError = await validateScheduleSlot(userId, dt, newCourse.duration_minutes);
      if (validationError) {
        toast.error(`الحصة ${i + 1}: ${validationError}`);
        return;
      }
    }

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
      course_start_date: courseStartDate,
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

  const handleDeleteCourse = async (courseId: string) => {
    // Delete session schedules first, then the lesson
    await supabase.from("group_session_schedules").delete().eq("lesson_id", courseId);
    const { error } = await supabase.from("lessons").delete().eq("id", courseId);
    if (error) {
      toast.error("لا يمكن حذف الكورس - قد يكون هناك حجوزات مرتبطة به");
    } else {
      toast.success("تم حذف الكورس");
      fetchCourses();
      onCoursesChange?.();
    }
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

    // Validate changed session dates for overlaps
    for (const sd of editSessionDates) {
      if (sd.scheduled_at) {
        const dt = new Date(sd.scheduled_at);
        const validationError = await validateScheduleSlot(
          userId, dt, editCourse.duration_minutes || 60,
          undefined, sd.id // exclude this session from overlap check
        );
        if (validationError) {
          toast.error(`الحصة ${sd.session_number}: ${validationError}`);
          return;
        }
      }
    }

    // Auto-set course_start_date from earliest session date
    const filledEditDates = editSessionDates.filter(sd => sd.scheduled_at).map(sd => new Date(sd.scheduled_at));
    const autoStartDate = filledEditDates.length > 0
      ? filledEditDates.sort((a, b) => a.getTime() - b.getTime())[0].toISOString()
      : editCourse.course_start_date ? new Date(editCourse.course_start_date).toISOString() : null;

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
      course_start_date: autoStartDate,
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

    // Get enrolled count
    const { count } = await supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", course.id)
      .in("status", ["pending", "accepted", "scheduled"]);
    setEnrolledInManaging(count ?? 0);
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

    // Check if ALL sessions are now completed → auto-complete course
    const { data: allSessions } = await supabase.from("group_session_schedules")
      .select("status").eq("lesson_id", managingCourse.id);
    const allCompleted = allSessions && allSessions.length > 0 && allSessions.every(s => s.status === "completed");

    if (allCompleted) {
      // Deactivate the lesson
      await supabase.from("lessons").update({ is_active: false }).eq("id", managingCourse.id);

      // Complete all active bookings for this course
      const { data: activeBookings } = await supabase.from("bookings")
        .select("id").eq("lesson_id", managingCourse.id)
        .in("status", ["pending", "accepted", "scheduled"]);
      if (activeBookings && activeBookings.length > 0) {
        for (const ab of activeBookings) {
          await supabase.from("bookings").update({
            status: "completed",
            zoom_join_url: null,
            zoom_start_url: null,
            zoom_meeting_id: null,
          }).eq("id", ab.id);
        }
      }

      toast.success("تم إكمال جميع الحصص! تم إغلاق الكورس وتحويله إلى مكتمل");
      setManagingCourse({ ...managingCourse, is_active: false });
    }

    openManageSessions(allCompleted ? { ...managingCourse, is_active: false } : managingCourse);
  };

  const handleDeleteSession = async (session: any) => {
    await supabase.from("group_session_schedules").delete().eq("id", session.id);
    toast.success("تم حذف الحصة");
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

  const handleSaveSessionEdit = async (session: any) => {
    if (editingSessionDate) {
      const dt = new Date(editingSessionDate);
      const duration = managingCourse?.duration_minutes || 60;
      const validationError = await validateScheduleSlot(userId, dt, duration, undefined, session.id);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }
    const updateData: any = {
      scheduled_at: editingSessionDate ? new Date(editingSessionDate).toISOString() : null,
      title: editingSessionTitle.trim() || null,
    };
    await supabase.from("group_session_schedules").update(updateData).eq("id", session.id);
    toast.success("تم تعديل الحصة");
    setEditingSessionId(null);
    setEditingSessionDate("");
    setEditingSessionTitle("");
    openManageSessions(managingCourse);
  };

  const sessionStatusLabel = (s: string) => {
    const map: Record<string, string> = { pending: "لم تبدأ", active: "جارية", completed: "منتهية" };
    return map[s] ?? s;
  };
  const sessionStatusColor = (s: string) => {
    const map: Record<string, string> = { pending: "bg-muted text-muted-foreground", active: "bg-primary/10 text-primary", completed: "bg-green-100 text-green-700" };
    return map[s] ?? "";
  };

  const completedSessions = courseSessions.filter(s => s.status === "completed").length;
  const activeSessions = courseSessions.filter(s => s.status === "active").length;
  const scheduledSessions = courseSessions.filter(s => s.scheduled_at).length;

  // Session management view
  if (managingCourse) {
    return (
      <div dir="rtl">
        <button onClick={() => { setManagingCourse(null); fetchCourses(); }} className="text-sm text-primary flex items-center gap-1 mb-4">
          <ArrowRight className="h-4 w-4" />
          رجوع للكورسات
        </button>
        <h2 className="text-lg font-bold mb-1">{managingCourse.title}</h2>
        
        {/* Course stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-primary">{enrolledInManaging}</p>
            <p className="text-[10px] text-muted-foreground">طالب منتسب</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">{completedSessions}</p>
            <p className="text-[10px] text-muted-foreground">حصة منتهية</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-lg font-bold">{scheduledSessions}</p>
            <p className="text-[10px] text-muted-foreground">حصة مجدولة</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {courseSessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد حصص مجدولة لهذا الكورس</p>
          ) : (
            courseSessions.map((session) => (
              <div key={session.id} className="bg-card rounded-xl p-4 border border-border">
                {editingSessionId === session.id ? (
                  /* Inline edit mode */
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">اسم الحصة (اختياري)</Label>
                      <Input placeholder={`حصة ${session.session_number}`} value={editingSessionTitle}
                        onChange={e => setEditingSessionTitle(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">موعد الحصة</Label>
                      <Input type="datetime-local" value={editingSessionDate}
                        onChange={e => setEditingSessionDate(e.target.value)} className="mt-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveSessionEdit(session)} className="flex-1">حفظ</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingSessionId(null); setEditingSessionTitle(""); }} className="flex-1">إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{session.title || `حصة ${session.session_number}`}</h3>
                    {session.scheduled_at ? (
                      <p className="text-xs text-muted-foreground">{new Date(session.scheduled_at).toLocaleString("ar")}</p>
                    ) : (
                      <p className="text-xs text-orange-500">لم يتم تحديد الموعد</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${sessionStatusColor(session.status)}`}>
                      {sessionStatusLabel(session.status)}
                    </span>
                    {session.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          setEditingSessionId(session.id);
                          setEditingSessionDate(session.scheduled_at ? new Date(session.scheduled_at).toISOString().slice(0, 16) : "");
                          setEditingSessionTitle(session.title || "");
                        }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الحصة</AlertDialogTitle>
                              <AlertDialogDescription>هل أنت متأكد من حذف الحصة {session.session_number}؟</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSession(session)}>حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>

                {/* Start session - show for pending sessions with a scheduled date */}
                {session.status === "pending" && session.scheduled_at && (
                  <Button size="sm" variant="hero" className="w-full mb-2"
                    disabled={startingSessionId === session.id}
                    onClick={() => handleStartSession(session)}>
                    {startingSessionId === session.id ? (
                      <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري إنشاء الرابط...</>
                    ) : (
                      <><PlayCircle className="h-4 w-4 ml-2" />بدء الحصة (إنشاء رابط زوم)</>
                    )}
                  </Button>
                )}

                {/* Pending without date - prompt to set date */}
                {session.status === "pending" && !session.scheduled_at && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => {
                    setEditingSessionId(session.id);
                    setEditingSessionDate("");
                  }}>
                    <CalendarDays className="h-4 w-4 ml-2" />
                    تحديد موعد الحصة
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
                    {session.zoom_join_url && (
                      <div className="bg-muted rounded-lg p-2 mb-2">
                        <p className="text-[10px] text-muted-foreground mb-1">رابط الدخول للطلاب:</p>
                        <p className="text-xs break-all font-mono">{session.zoom_join_url}</p>
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="w-full mb-2 text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => handleEndSession(session)}>
                      <CheckCircle className="h-4 w-4 ml-2" />
                      إنهاء الحصة
                    </Button>
                  </>
                )}

                {/* Completed - upload recording or show status */}
                {session.status === "completed" && (
                  <div className="space-y-2">
                    {!session.recording_url ? (
                      <Button size="sm" variant="outline" className="w-full text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => handleUploadSessionRecording(session)}
                        disabled={uploadingSessionId === session.id}>
                        {uploadingSessionId === session.id ? (
                          <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الرفع...</>
                        ) : (
                          <><Upload className="h-4 w-4 ml-2" />رفع تسجيل الحصة</>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>تم رفع التسجيل</span>
                      </div>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // CourseFormFields is now defined outside the component to avoid re-mounting

function CourseFormFields({ form, setForm, isEdit, curricula, gradeLevels, setGradeLevels, subjects, setSubjects, editSessionDates, setEditSessionDates }: {
  form: any; setForm: (f: any) => void; isEdit?: boolean;
  curricula: any[]; gradeLevels: any[]; setGradeLevels: (g: any[]) => void;
  subjects: any[]; setSubjects: (s: any[]) => void;
  editSessionDates?: any[]; setEditSessionDates?: (d: any) => void;
}) {
  return (
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
        <div><Label>عدد الحصص المقررة (5 كحد أدنى)</Label>
          <Input type="number" min={5} value={form.total_sessions || 5} onChange={(e) => {
            const val = Math.max(5, parseInt(e.target.value) || 5);
            if (!isEdit) {
              const dates = [...(form.session_dates || [])];
              while (dates.length < val) dates.push("");
              setForm({ ...form, total_sessions: val, session_dates: dates.slice(0, val) });
            } else {
              setForm({ ...form, total_sessions: val });
              setEditSessionDates?.(prev => {
                const newDates = [...prev];
                while (newDates.length < val) newDates.push({ session_number: newDates.length + 1, scheduled_at: "" });
                return newDates.slice(0, val);
              });
            }
          }} />
        </div>

        {isEdit && form && (
          <div className="flex items-center gap-2">
            <Label>نشط</Label>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          </div>
        )}
      </div>
    </div>
  );
}



  return (
    <div dir="rtl">
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button variant="hero" className="mb-4 w-full">
            <Plus className="h-4 w-4 ml-2" />
            إضافة كورس جماعي جديد
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة كورس جماعي</DialogTitle></DialogHeader>
          <CourseFormFields form={newCourse} setForm={setNewCourse} curricula={curricula} gradeLevels={gradeLevels} setGradeLevels={setGradeLevels} subjects={subjects} setSubjects={setSubjects} />
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
              <CourseFormFields form={editCourse} setForm={setEditCourse} isEdit curricula={curricula} gradeLevels={gradeLevels} setGradeLevels={setGradeLevels} subjects={subjects} setSubjects={setSubjects} editSessionDates={editSessionDates} setEditSessionDates={setEditSessionDates} />
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
                <div className="flex-1">
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">{c.duration_minutes} دقيقة • {format(c.price)}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.expected_students} متوقع</span>
                    <span className="flex items-center gap-1 text-primary font-medium"><Users className="h-3 w-3" />{enrolledCounts[c.id] ?? 0} منتسب</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{c.total_sessions} حصة</span>
                    {c.course_start_date && (
                      <span>بداية: {new Date(c.course_start_date).toLocaleDateString("ar")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف الكورس</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف كورس "{c.title}"؟ سيتم حذف جميع الحصص المرتبطة.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCourse(c.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
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
