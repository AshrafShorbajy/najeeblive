import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Clock, CheckCircle, User, MessageCircle, Send, ArrowRight, Upload, PlayCircle, Loader2, Users, CalendarDays, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VideoPlayer } from "@/components/schedule/VideoPlayer";
import { useCurrency } from "@/contexts/CurrencyContext";
import { uploadFileCompat } from "@/lib/uploadFile";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function SchedulePage() {
  const { user, isTeacher } = useAuthContext();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [bookings, setBookings] = useState<any[]>([]);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [watchingBooking, setWatchingBooking] = useState<any | null>(null);
  const [watchingSession, setWatchingSession] = useState<any | null>(null);

  // Group course detail view
  const [viewingCourse, setViewingCourse] = useState<any | null>(null);
  const [courseSessions, setCourseSessions] = useState<any[]>([]);
  const [courseEnrolledCount, setCourseEnrolledCount] = useState(0);

  // Installment payment state
  const [installPayDialogOpen, setInstallPayDialogOpen] = useState(false);
  const [installPayBooking, setInstallPayBooking] = useState<any>(null);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [nextInstallmentInfo, setNextInstallmentInfo] = useState<any>(null);
  useEffect(() => {
    if (!user) return;
    const loadBookings = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, lessons(title, duration_minutes, lesson_type, total_sessions, expected_students, teacher_id)")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .order("scheduled_at", { ascending: true });

      const items = data ?? [];
      const teacherIds = [...new Set(items.filter(b => b.student_id === user.id).map(b => b.teacher_id))];
      let teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", teacherIds);
        profiles?.forEach(p => { teacherMap[p.user_id] = p.full_name; });
      }

      // For group lessons, fetch completed/total session counts
      const groupLessonIds = [...new Set(items.filter(b => (b as any).lessons?.lesson_type === "group").map(b => b.lesson_id))];
      let sessionCountMap: Record<string, { total: number; completed: number }> = {};
      if (groupLessonIds.length > 0) {
        for (const lid of groupLessonIds) {
          const { data: sessions } = await supabase.from("group_session_schedules")
            .select("status").eq("lesson_id", lid);
          const all = sessions ?? [];
          sessionCountMap[lid] = {
            total: all.length,
            completed: all.filter(s => (s as any).status === "completed").length,
          };
        }
      }

      // Enrolled count for group lessons
      let enrolledMap: Record<string, number> = {};
      if (groupLessonIds.length > 0) {
        for (const lid of groupLessonIds) {
          const { count } = await supabase.from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("lesson_id", lid)
            .in("status", ["scheduled", "accepted", "completed"]);
          enrolledMap[lid] = count ?? 0;
        }
      }

      setBookings(items.map(b => ({
        ...b,
        teacher_name: teacherMap[b.teacher_id] || "",
        session_counts: sessionCountMap[b.lesson_id],
        enrolled_count: enrolledMap[b.lesson_id] || 0,
      })));
    };
    loadBookings();

    // Realtime: auto-refresh bookings and group sessions
    const channel = supabase
      .channel("schedule-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" },
        () => loadBookings())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_session_schedules" },
        () => {
          // Refresh course sessions if viewing a course
          if (viewingCourse) {
            supabase.from("group_session_schedules")
              .select("*").eq("lesson_id", viewingCourse.lesson_id).order("session_number")
              .then(({ data }) => setCourseSessions(data ?? []));
          }
          loadBookings();
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
  // Fetch payment settings
  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "payment_methods").single()
      .then(({ data }) => {
        if (data?.value) {
          const ps = data.value as any;
          setPaymentSettings(ps);
          setPaymentMethod(prev => {
            if (prev) return prev;
            if (ps.paypal?.enabled) return "paypal";
            if (ps.bank_transfer?.enabled) return "bank_transfer";
            return "";
          });
        }
      });
  }, []);

  const getInstallmentInfo = (totalSessions: number, totalPrice: number) => {
    if (!totalSessions || totalSessions <= 5) return null;
    let numInstallments = 2;
    if (totalSessions >= 11 && totalSessions <= 20) numInstallments = 4;
    else if (totalSessions >= 21 && totalSessions <= 50) numInstallments = 6;
    const sessionsPerInstallment = Math.ceil(totalSessions / numInstallments);
    const amountPerInstallment = Math.ceil((totalPrice / numInstallments) * 100) / 100;
    return { numInstallments, sessionsPerInstallment, amountPerInstallment };
  };

  const openInstallmentPayment = async (booking: any) => {
    setInstallPayBooking(booking);
    // Fetch existing installments to determine the next one
    const { data: installments } = await (supabase.from("course_installments" as any) as any)
      .select("*").eq("booking_id", booking.id).order("installment_number");
    
    // Count all installments (paid + pending) to determine the next number
    // Initial booking = installment 1, so next payment starts from 2
    const allInstallments = installments ?? [];
    const nextNumber = allInstallments.length + 2;
    
    // Get lesson price for calculation
    const { data: lesson } = await supabase.from("lessons").select("price, total_sessions").eq("id", booking.lesson_id).single();
    if (!lesson) { toast.error("خطأ في تحميل بيانات الكورس"); return; }

    const info = getInstallmentInfo(lesson.total_sessions!, lesson.price);
    if (!info) { toast.error("هذا الكورس لا يدعم الأقساط"); return; }

    setNextInstallmentInfo({
      installmentNumber: nextNumber,
      amount: info.amountPerInstallment,
      sessionsToUnlock: info.sessionsPerInstallment,
      totalInstallments: info.numInstallments,
      lessonTitle: booking.lessons?.title,
    });
    setReceiptFile(null);
    setInstallPayDialogOpen(true);
  };

  const handleInstallmentPayPalSuccess = async (orderData: any) => {
    if (!user || !installPayBooking || !nextInstallmentInfo) return;
    setPaying(true);
    try {
      // Create installment record
      const { error: instError } = await (supabase.from("course_installments" as any) as any).insert({
        booking_id: installPayBooking.id,
        installment_number: nextInstallmentInfo.installmentNumber,
        amount: nextInstallmentInfo.amount,
        sessions_unlocked: nextInstallmentInfo.sessionsToUnlock,
        status: "paid",
        paid_at: new Date().toISOString(),
      });
      if (instError) { console.error("Installment insert error:", instError); throw instError; }

      // Update booking paid_sessions
      const newPaidSessions = (installPayBooking.paid_sessions || 0) + nextInstallmentInfo.sessionsToUnlock;
      const { error: bookingError } = await supabase.from("bookings").update({ paid_sessions: newPaidSessions }).eq("id", installPayBooking.id);
      if (bookingError) { console.error("Booking update error:", bookingError); throw bookingError; }

      // Create paid invoice
      const { error: invoiceError } = await supabase.from("invoices").insert({
        booking_id: installPayBooking.id,
        student_id: user.id,
        teacher_id: installPayBooking.teacher_id,
        lesson_id: installPayBooking.lesson_id,
        amount: nextInstallmentInfo.amount,
        payment_method: "paypal",
        status: "paid",
      } as any);
      if (invoiceError) { console.error("Invoice insert error:", invoiceError); throw invoiceError; }

      setBookings(prev => prev.map(b => b.id === installPayBooking.id ? { ...b, paid_sessions: newPaidSessions } : b));
      toast.success(`تم دفع الدفعة ${nextInstallmentInfo.installmentNumber} بنجاح! تم فتح ${nextInstallmentInfo.sessionsToUnlock} حصص إضافية`);
      setInstallPayDialogOpen(false);
      // Refresh course detail
      if (viewingCourse?.id === installPayBooking.id) {
        setViewingCourse({ ...viewingCourse, paid_sessions: newPaidSessions });
      }
    } catch (err: any) { console.error("PayPal installment error:", err); toast.error("خطأ في معالجة الدفع: " + (err?.message || "")); }
    finally { setPaying(false); }
  };

  const handleInstallmentBankTransfer = async () => {
    if (!user || !installPayBooking || !nextInstallmentInfo) return;
    if (!receiptFile) { toast.error("يجب إرفاق صورة إيصال التحويل البنكي"); return; }
    setPaying(true);
    try {
      const path = `${user.id}/${Date.now()}-${receiptFile.name}`;
      const { publicUrl } = await uploadFileCompat("uploads", path, receiptFile);

      // Create installment record (pending admin approval)
      const { error: instError } = await (supabase.from("course_installments" as any) as any).insert({
        booking_id: installPayBooking.id,
        installment_number: nextInstallmentInfo.installmentNumber,
        amount: nextInstallmentInfo.amount,
        sessions_unlocked: nextInstallmentInfo.sessionsToUnlock,
        status: "pending",
      });
      if (instError) { console.error("Installment insert error:", instError); throw instError; }

      // Create pending invoice
      const { error: invoiceError } = await supabase.from("invoices").insert({
        booking_id: installPayBooking.id,
        student_id: user.id,
        teacher_id: installPayBooking.teacher_id,
        lesson_id: installPayBooking.lesson_id,
        amount: nextInstallmentInfo.amount,
        payment_method: "bank_transfer",
        payment_receipt_url: publicUrl,
      } as any);
      if (invoiceError) { console.error("Invoice insert error:", invoiceError); throw invoiceError; }

      toast.success("تم إرسال طلب الدفعة بنجاح! سيتم مراجعة الإيصال من الإدارة");
      setInstallPayDialogOpen(false);
    } catch (err: any) { console.error("Bank transfer error:", err); toast.error("خطأ في رفع الإيصال: " + (err?.message || "")); }
    finally { setPaying(false); }
  };

  // Upload recording handler (teacher only, individual lessons)
  const handleUploadRecording = async (bookingId: string, teacherId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 500 * 1024 * 1024) { toast.error("حجم الملف كبير جداً (الحد الأقصى 500 ميغابايت)"); return; }
      setUploadingId(bookingId);
      try {
        const ext = file.name.split(".").pop();
        const path = `${teacherId}/${bookingId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("recordings").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(path);
        await supabase.from("bookings").update({ recording_url: urlData.publicUrl }).eq("id", bookingId);
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, recording_url: urlData.publicUrl } : b));
        toast.success("تم رفع التسجيل بنجاح");
      } catch { toast.error("خطأ في رفع التسجيل"); }
      finally { setUploadingId(null); }
    };
    input.click();
  };

  // Open group course detail
  const openCourseDetail = async (booking: any) => {
    setViewingCourse(booking);
    const { data } = await supabase.from("group_session_schedules")
      .select("*").eq("lesson_id", booking.lesson_id).order("session_number");
    setCourseSessions(data ?? []);
    const { count } = await supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", booking.lesson_id)
      .in("status", ["scheduled", "accepted", "completed"]);
    setCourseEnrolledCount(count ?? 0);
  };

  // Open chat for a booking
  const openChat = async (booking: any) => {
    if (!user) return;
    setViewingCourse(null); // Clear course detail view so chat can render
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

  const isGroupLesson = (b: any) => (b as any).lessons?.lesson_type === "group";

  // Watching session recording (group course)
  if (watchingSession) {
    return (
      <AppLayout>
        <div className="px-4 py-6 max-w-3xl mx-auto">
          <button onClick={() => setWatchingSession(null)} className="text-sm text-primary flex items-center gap-1 mb-4">
            <ArrowRight className="h-4 w-4" />رجوع
          </button>
          <h2 className="text-lg font-bold mb-4">{(watchingSession as any).title || `حصة ${watchingSession.session_number}`} - تسجيل</h2>
          <VideoPlayer src={watchingSession.recording_url} title={(watchingSession as any).title || `حصة ${watchingSession.session_number}`} />
        </div>
      </AppLayout>
    );
  }

  // Video player view (individual lesson)
  if (watchingBooking) {
    return (
      <AppLayout>
        <div className="px-4 py-6 max-w-3xl mx-auto">
          <button onClick={() => setWatchingBooking(null)} className="text-sm text-primary flex items-center gap-1 mb-4">
            <ArrowRight className="h-4 w-4" />رجوع للجدول
          </button>
          <h2 className="text-lg font-bold mb-4">{watchingBooking.lessons?.title ?? "تسجيل الحصة"}</h2>
          <VideoPlayer src={watchingBooking.recording_url} title={watchingBooking.lessons?.title} />
        </div>
      </AppLayout>
    );
  }

  // Group course detail view
  if (viewingCourse) {
    const isInstallmentCourse = (viewingCourse as any).is_installment;
    const paidSessions = isInstallmentCourse
      ? ((viewingCourse as any).paid_sessions ?? 0)
      : (viewingCourse.lessons?.total_sessions || 999);
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <button onClick={() => setViewingCourse(null)} className="text-sm text-primary flex items-center gap-1 mb-4">
            <ArrowRight className="h-4 w-4" />رجوع للجدول
          </button>
          <div className="bg-card rounded-xl p-4 border border-border mb-4">
            <h2 className="text-lg font-bold">{viewingCourse.lessons?.title}</h2>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {viewingCourse.teacher_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />المعلم: {viewingCourse.teacher_name}</span>}
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{courseEnrolledCount} طالب</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{viewingCourse.lessons?.total_sessions} حصة</span>
            </div>
            {/* Installment payment warning - hidden when course is inactive/completed */}
            {(viewingCourse as any).is_installment && paidSessions < (viewingCourse.lessons?.total_sessions || 0) && viewingCourse.status !== "completed" && (
              <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm space-y-2">
                <p className="font-semibold text-warning mb-1">⚠️ يجب دفع الدفعة التالية</p>
                <p className="text-xs text-muted-foreground">الحصص المدفوعة: {paidSessions} من {viewingCourse.lessons?.total_sessions}</p>
                <Button size="sm" variant="hero" className="w-full"
                  onClick={() => openInstallmentPayment(viewingCourse)}>
                  <CreditCard className="h-4 w-4 ml-2" />دفع الدفعة التالية
                </Button>
              </div>
            )}
          </div>

          <h3 className="font-semibold mb-3">حصص الكورس</h3>
          <div className="space-y-3">
            {courseSessions.filter(s => s.scheduled_at).map((session) => {
              const sessionStatus = (session as any).status || "pending";
              const isUnlocked = session.session_number <= paidSessions;
              return (
                <div key={session.id} className={`bg-card rounded-xl p-4 border ${isUnlocked ? "border-border" : "border-destructive/30 opacity-60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{(session as any).title || `حصة ${session.session_number}`}</h4>
                      <p className="text-xs text-muted-foreground">{new Date(session.scheduled_at).toLocaleString("ar")}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      sessionStatus === "completed" ? "bg-success/10 text-success" :
                      sessionStatus === "active" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {sessionStatus === "completed" ? "منتهية" : sessionStatus === "active" ? "جارية" : "لم تبدأ"}
                    </span>
                  </div>

                  {!isUnlocked && (
                    <p className="text-xs text-destructive mb-2">🔒 يجب دفع الدفعة التالية لفتح هذه الحصة</p>
                  )}

                  {isUnlocked && sessionStatus === "active" && (session as any).zoom_join_url && (
                    <a href={(session as any).zoom_join_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="hero" className="w-full mb-2">
                        <Video className="h-4 w-4 ml-2" />دخول الحصة
                      </Button>
                    </a>
                  )}

                  {isUnlocked && sessionStatus === "completed" && (session as any).recording_url && (
                    <Button size="sm" variant="outline" className="w-full text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => setWatchingSession(session)}>
                      <PlayCircle className="h-4 w-4 ml-2" />مشاهدة تسجيل الحصة
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chat button */}
          <Button size="sm" variant="outline" className="w-full mt-4" onClick={() => openChat(viewingCourse)}>
            <MessageCircle className="h-4 w-4 ml-2" />مراسلة المعلم
          </Button>

          {/* Installment Payment Dialog (inside course detail view) */}
          <Dialog open={installPayDialogOpen} onOpenChange={setInstallPayDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>دفع الدفعة التالية</DialogTitle>
              </DialogHeader>
              {nextInstallmentInfo && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-1">
                    <p className="font-semibold">{nextInstallmentInfo.lessonTitle}</p>
                    <p>الدفعة {nextInstallmentInfo.installmentNumber} من {nextInstallmentInfo.totalInstallments}</p>
                    <p>المبلغ المطلوب: <strong className="text-primary">{format(nextInstallmentInfo.amount)}</strong></p>
                    <p className="text-xs text-muted-foreground">سيتم فتح {nextInstallmentInfo.sessionsToUnlock} حصص إضافية</p>
                  </div>

                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                    {paymentSettings?.paypal?.enabled && (
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="paypal" id="cv-inst-paypal" />
                        <Label htmlFor="cv-inst-paypal" className="flex items-center gap-2">
                          البطاقة الإئتمانية
                          <div className="flex items-center gap-1">
                            <img src="https://cdn-icons-png.flaticon.com/32/349/349221.png" alt="Visa" className="h-5" />
                            <img src="https://cdn-icons-png.flaticon.com/32/349/349228.png" alt="Mastercard" className="h-5" />
                          </div>
                        </Label>
                      </div>
                    )}
                    {paymentSettings?.bank_transfer?.enabled && (
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="bank_transfer" id="cv-inst-bank" />
                        <Label htmlFor="cv-inst-bank">تحويل بنكي</Label>
                      </div>
                    )}
                  </RadioGroup>

                  {paymentMethod === "paypal" && paymentSettings?.paypal?.client_id && (
                    <div className="space-y-3 paypal-card-only">
                      <style>{`.paypal-card-only .paypal-powered-by { display: none !important; }`}</style>
                      <PayPalScriptProvider
                        key={`cv-inst-paypal-${paymentSettings.paypal.sandbox ? "sandbox" : "live"}-${paymentSettings.paypal.client_id.slice(-6)}`}
                        options={{
                          clientId: paymentSettings.paypal.client_id,
                          currency: "USD",
                          intent: "capture",
                          components: "buttons",
                          dataNamespace: "paypal_cv_inst_sdk",
                        }}
                      >
                        <PayPalButtons
                          fundingSource="card"
                          style={{ layout: "vertical", shape: "rect", label: "pay", color: "black", tagline: false }}
                          disabled={paying}
                          createOrder={(_data: any, actions: any) => {
                            return actions.order.create({
                              intent: "CAPTURE",
                              purchase_units: [{
                                amount: { value: String(nextInstallmentInfo.amount), currency_code: "USD" },
                                description: `${nextInstallmentInfo.lessonTitle} - الدفعة ${nextInstallmentInfo.installmentNumber}`,
                              }],
                              application_context: { shipping_preference: "NO_SHIPPING" },
                            });
                          }}
                          onApprove={async (_data: any, actions: any) => {
                            try {
                              const order = await actions.order?.capture();
                              if (order?.status === "COMPLETED") {
                                await handleInstallmentPayPalSuccess(order);
                              } else { toast.error("لم يتم إكمال الدفع"); }
                            } catch { toast.error("حدث خطأ أثناء معالجة الدفع"); }
                          }}
                          onError={() => toast.error("حدث خطأ في PayPal")}
                        />
                      </PayPalScriptProvider>
                    </div>
                  )}

                  {paymentMethod === "bank_transfer" && paymentSettings?.bank_transfer && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                        {paymentSettings.bank_transfer.bank_logo_url && (
                          <img src={paymentSettings.bank_transfer.bank_logo_url} alt="لوجو البنك" className="h-10 w-auto object-contain" />
                        )}
                        <p className="font-medium">بيانات التحويل:</p>
                        {paymentSettings.bank_transfer.account_number && (
                          <p>رقم الحساب: <span dir="ltr" className="font-mono">{paymentSettings.bank_transfer.account_number}</span></p>
                        )}
                        {paymentSettings.bank_transfer.account_holder && (
                          <p>اسم صاحب الحساب: {paymentSettings.bank_transfer.account_holder}</p>
                        )}
                        {paymentSettings.bank_transfer.branch && (
                          <p>الفرع: {paymentSettings.bank_transfer.branch}</p>
                        )}
                      </div>
                      <div>
                        <Label>إرفاق صورة الإيصال</Label>
                        <input type="file" accept="image/*" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); setReceiptFile(e.target.files?.[0] ?? null); }} />
                      </div>
                      <Button onClick={handleInstallmentBankTransfer} disabled={paying} className="w-full" variant="hero">
                        {paying ? "جارٍ التحميل..." : "إتمام الدفع"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
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
              <ArrowRight className="h-4 w-4" />رجوع
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
                        {/* Tag: individual or group */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isGroupLesson(b) 
                              ? "bg-secondary/10 text-secondary border border-secondary/20" 
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}>
                            {isGroupLesson(b) ? "كورس جماعي" : "حصة فردية"}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(b.status)}`}>{statusLabel(b.status)}</span>
                        </div>

                        <h3 className="font-semibold">{(b as any).lessons?.title ?? "حصة"}</h3>

                        {b.student_id === user?.id && b.teacher_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <User className="h-4 w-4" />
                            <span>المعلم: {b.teacher_name}</span>
                          </div>
                        )}

                        {/* Group course metadata */}
                        {isGroupLesson(b) && (
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />
                              {b.session_counts ? `${b.session_counts.completed}/${b.session_counts.total} حصة منتهية` : `${b.lessons?.total_sessions} حصة`}
                            </span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.enrolled_count} طالب</span>
                          </div>
                        )}

                        {b.scheduled_at && !isGroupLesson(b) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-4 w-4" />
                            <span>{new Date(b.scheduled_at).toLocaleString("ar")}</span>
                          </div>
                        )}

                        {/* Group course - view sessions button */}
                        {isGroupLesson(b) && b.student_id === user?.id && (
                          <Button size="sm" variant="outline" className="w-full mt-2 text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => openCourseDetail(b)}>
                            <CalendarDays className="h-4 w-4 ml-2" />عرض حصص الكورس
                          </Button>
                        )}

                        {/* Individual lesson actions */}
                        {!isGroupLesson(b) && b.status === "scheduled" && b.teacher_id === user?.id && isTeacher && (
                          <Button size="sm" variant="outline" className="w-full mb-2 mt-2 text-success border-success/30 hover:bg-success/10"
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
                            <CheckCircle className="h-4 w-4 ml-2" />إنهاء الحصة
                          </Button>
                        )}
                        {!isGroupLesson(b) && b.status === "scheduled" && (b.zoom_join_url || b.zoom_start_url) && (
                          <a href={b.teacher_id === user?.id ? (b.zoom_start_url ?? b.zoom_join_url) : b.zoom_join_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="hero" className="w-full mb-2">
                              <Video className="h-4 w-4 ml-2" />
                              {b.teacher_id === user?.id ? "بدء الحصة (زوم)" : "دخول الحصة عبر زوم"}
                            </Button>
                          </a>
                        )}
                        {!isGroupLesson(b) && b.status === "completed" && b.teacher_id === user?.id && isTeacher && !b.recording_url && (
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
                        {!isGroupLesson(b) && b.status === "completed" && b.teacher_id === user?.id && isTeacher && b.recording_url && (
                          <div className="flex items-center gap-2 text-sm text-success mb-2">
                            <CheckCircle className="h-4 w-4" /><span>تم رفع التسجيل</span>
                          </div>
                        )}
                        {!isGroupLesson(b) && b.status === "completed" && b.student_id === user?.id && b.recording_url && (
                          <Button size="sm" variant="outline" className="w-full mb-2 text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => setWatchingBooking(b)}>
                            <PlayCircle className="h-4 w-4 ml-2" />مشاهدة تسجيل الحصة
                          </Button>
                        )}

                        {/* Chat for individual lessons */}
                        {!isGroupLesson(b) && b.student_id === user?.id && (b.status === "accepted" || b.status === "scheduled" || b.status === "completed") && (
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

      {/* Installment Payment Dialog */}
      <Dialog open={installPayDialogOpen} onOpenChange={setInstallPayDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>دفع الدفعة التالية</DialogTitle>
          </DialogHeader>
          {nextInstallmentInfo && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-1">
                <p className="font-semibold">{nextInstallmentInfo.lessonTitle}</p>
                <p>الدفعة {nextInstallmentInfo.installmentNumber} من {nextInstallmentInfo.totalInstallments}</p>
                <p>المبلغ المطلوب: <strong className="text-primary">{format(nextInstallmentInfo.amount)}</strong></p>
                <p className="text-xs text-muted-foreground">سيتم فتح {nextInstallmentInfo.sessionsToUnlock} حصص إضافية</p>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                {paymentSettings?.paypal?.enabled && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="paypal" id="inst-paypal" />
                    <Label htmlFor="inst-paypal" className="flex items-center gap-2">
                      البطاقة الإئتمانية
                      <div className="flex items-center gap-1">
                        <img src="https://cdn-icons-png.flaticon.com/32/349/349221.png" alt="Visa" className="h-5" />
                        <img src="https://cdn-icons-png.flaticon.com/32/349/349228.png" alt="Mastercard" className="h-5" />
                      </div>
                    </Label>
                  </div>
                )}
                {paymentSettings?.bank_transfer?.enabled && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="bank_transfer" id="inst-bank" />
                    <Label htmlFor="inst-bank">تحويل بنكي</Label>
                  </div>
                )}
              </RadioGroup>

              {paymentMethod === "paypal" && paymentSettings?.paypal?.client_id && (
                <div className="space-y-3 paypal-card-only">
                  <style>{`
                    .paypal-card-only .paypal-powered-by,
                    .paypal-card-only [data-funding-source] .paypal-powered-by { display: none !important; }
                  `}</style>
                  <PayPalScriptProvider
                    key={`inst-paypal-${paymentSettings.paypal.sandbox ? "sandbox" : "live"}-${paymentSettings.paypal.client_id.slice(-6)}`}
                    options={{
                      clientId: paymentSettings.paypal.client_id,
                      currency: "USD",
                      intent: "capture",
                      components: "buttons",
                      dataNamespace: "paypal_inst_sdk",
                    }}
                  >
                    <PayPalButtons
                      fundingSource="card"
                      style={{ layout: "vertical", shape: "rect", label: "pay", color: "black", tagline: false }}
                      disabled={paying}
                      createOrder={(_data: any, actions: any) => {
                        return actions.order.create({
                          intent: "CAPTURE",
                          purchase_units: [{
                            amount: { value: String(nextInstallmentInfo.amount), currency_code: "USD" },
                            description: `${nextInstallmentInfo.lessonTitle} - الدفعة ${nextInstallmentInfo.installmentNumber}`,
                          }],
                          application_context: { shipping_preference: "NO_SHIPPING" },
                        });
                      }}
                      onApprove={async (_data: any, actions: any) => {
                        try {
                          const order = await actions.order?.capture();
                          if (order?.status === "COMPLETED") {
                            await handleInstallmentPayPalSuccess(order);
                          } else { toast.error("لم يتم إكمال الدفع"); }
                        } catch { toast.error("حدث خطأ أثناء معالجة الدفع"); }
                      }}
                      onError={() => toast.error("حدث خطأ في PayPal")}
                    />
                  </PayPalScriptProvider>
                </div>
              )}

              {paymentMethod === "bank_transfer" && paymentSettings?.bank_transfer && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                    {paymentSettings.bank_transfer.bank_logo_url && (
                      <img src={paymentSettings.bank_transfer.bank_logo_url} alt="لوجو البنك" className="h-10 w-auto object-contain" />
                    )}
                    <p className="font-medium">بيانات التحويل:</p>
                    {paymentSettings.bank_transfer.account_number && (
                      <p>رقم الحساب: <span dir="ltr" className="font-mono">{paymentSettings.bank_transfer.account_number}</span></p>
                    )}
                    {paymentSettings.bank_transfer.account_holder && (
                      <p>اسم صاحب الحساب: {paymentSettings.bank_transfer.account_holder}</p>
                    )}
                    {paymentSettings.bank_transfer.branch && (
                      <p>الفرع: {paymentSettings.bank_transfer.branch}</p>
                    )}
                  </div>
                  <div>
                    <Label>إرفاق صورة الإيصال</Label>
                    <input type="file" accept="image/*" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); setReceiptFile(e.target.files?.[0] ?? null); }} />
                  </div>
                  <Button onClick={handleInstallmentBankTransfer} disabled={paying} className="w-full" variant="hero">
                    {paying ? "جارٍ التحميل..." : "إتمام الدفع"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
