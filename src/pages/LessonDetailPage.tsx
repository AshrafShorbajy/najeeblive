import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Star, Clock, User, AlertTriangle, Video, Users, CalendarDays, Hash } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/contexts/CurrencyContext";
import { uploadFileCompat } from "@/lib/uploadFile";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [lesson, setLesson] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [sessionSchedules, setSessionSchedules] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  // Installment state
  const [paymentPlan, setPaymentPlan] = useState<"full" | "installment">("full");

  // Calculate installment info based on total sessions
  const getInstallmentInfo = (totalSessions: number, totalPrice: number) => {
    if (!totalSessions || totalSessions <= 5) return null; // No installments for ≤5 sessions
    let numInstallments = 2;
    if (totalSessions >= 11 && totalSessions <= 20) numInstallments = 4;
    else if (totalSessions >= 21 && totalSessions <= 50) numInstallments = 6;
    const sessionsPerInstallment = Math.ceil(totalSessions / numInstallments);
    const amountPerInstallment = Math.ceil((totalPrice / numInstallments) * 100) / 100;
    return { numInstallments, sessionsPerInstallment, amountPerInstallment };
  };

  const installmentInfo = lesson ? getInstallmentInfo(lesson.total_sessions, lesson.price) : null;
  const currentPayAmount = lesson ? (
    paymentPlan === "full" || !installmentInfo
      ? lesson.price
      : installmentInfo.amountPerInstallment
  ) : 0;
  const currentPaidSessions = lesson ? (
    paymentPlan === "full" || !installmentInfo
      ? (lesson.total_sessions || 999)
      : installmentInfo.sessionsPerInstallment
  ) : 0;

  useEffect(() => {
    if (!id) return;
    supabase.from("lessons").select("*").eq("id", id).single()
      .then(({ data }) => {
        setLesson(data);
        if (data) {
          supabase.from("profiles").select("*").eq("user_id", data.teacher_id).single()
            .then(({ data: p }) => setTeacher(p));
          // Fetch enrolled count for group lessons
          if (data.lesson_type === "group") {
            supabase.from("bookings").select("id", { count: "exact", head: true })
              .eq("lesson_id", id)
              .in("status", ["pending", "accepted", "scheduled"])
              .then(({ count }) => setEnrolledCount(count ?? 0));
            // Fetch session schedules
            supabase.from("group_session_schedules").select("*")
              .eq("lesson_id", id)
              .order("session_number")
              .then(({ data: schedules }) => setSessionSchedules(schedules ?? []));
          }
        }
      });

    supabase.from("reviews").select("*").eq("lesson_id", id)
      .then(async ({ data: reviewsData }) => {
        if (reviewsData && reviewsData.length > 0) {
          const studentIds = [...new Set(reviewsData.map(r => r.student_id))];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", studentIds);
          const profileMap: Record<string, string> = {};
          profilesData?.forEach(p => { profileMap[p.user_id] = p.full_name; });
          const enriched = reviewsData.map(r => ({ ...r, reviewer_name: profileMap[r.student_id] || "" }));
          setReviews(enriched);
        } else {
          setReviews([]);
        }
      });

    if (user) {
      supabase.from("bookings").select("*").eq("lesson_id", id).eq("student_id", user.id)
        .then(({ data }) => setBookings(data ?? []));
    }

    // Fetch payment settings
    supabase.from("site_settings").select("value").eq("key", "payment_methods").single()
      .then(({ data }) => {
        if (data?.value) {
          const ps = data.value as any;
          setPaymentSettings(ps);
          if (ps.paypal?.enabled) setPaymentMethod("paypal");
          else if (ps.bank_transfer?.enabled) setPaymentMethod("bank_transfer");
        }
      });
  }, [id, user]);

  const handlePayPalSuccess = async (orderData: any) => {
    if (!user || !lesson) return;
    setBuying(true);

    const isInstallment = lesson.lesson_type === "group" && paymentPlan === "installment" && installmentInfo;
    const bookingStatus = lesson.lesson_type === "group" ? "scheduled" : "accepted";

    // Create booking
    const { data: bookingData, error } = await supabase.from("bookings").insert({
      student_id: user.id,
      lesson_id: lesson.id,
      teacher_id: lesson.teacher_id,
      amount: currentPayAmount,
      payment_method: "paypal" as any,
      status: bookingStatus,
      ...(isInstallment ? {
        is_installment: true,
        total_installments: installmentInfo!.numInstallments,
        paid_sessions: installmentInfo!.sessionsPerInstallment,
      } : {}),
    } as any).select().single();

    if (error || !bookingData) {
      toast.error("حدث خطأ في الحجز");
      setBuying(false);
      return;
    }

    // Auto-create invoice as paid
    await supabase.from("invoices").insert({
      booking_id: bookingData.id,
      student_id: user.id,
      teacher_id: lesson.teacher_id,
      lesson_id: lesson.id,
      amount: currentPayAmount,
      payment_method: "paypal",
      status: "paid",
    } as any);

    // Create installment record if applicable
    if (isInstallment) {
      await (supabase.from("course_installments" as any) as any).insert({
        booking_id: bookingData.id,
        installment_number: 1,
        amount: installmentInfo!.amountPerInstallment,
        sessions_unlocked: installmentInfo!.sessionsPerInstallment,
        status: "paid",
        paid_at: new Date().toISOString(),
      });
    }

    // Auto-create conversation
    await supabase.from("conversations").insert({
      student_id: user.id,
      teacher_id: lesson.teacher_id,
      booking_id: bookingData.id,
    });

    const successMsg = isInstallment
      ? `تم دفع الدفعة الأولى بنجاح! تم فتح ${installmentInfo!.sessionsPerInstallment} حصص من أصل ${lesson.total_sessions}`
      : lesson.lesson_type === "group"
        ? "تم الدفع بنجاح! تم تسجيلك في الكورس الجماعي"
        : "تم الدفع بنجاح! يمكنك الآن التواصل مع المعلم لتحديد موعد الحصة";
    toast.success(successMsg);
    setBuyDialogOpen(false);
    const { data } = await supabase.from("bookings").select("*").eq("lesson_id", id).eq("student_id", user.id);
    setBookings(data ?? []);
    if (lesson.lesson_type === "group") {
      supabase.from("bookings").select("id", { count: "exact", head: true })
        .eq("lesson_id", id).in("status", ["pending", "accepted", "scheduled"])
        .then(({ count }) => setEnrolledCount(count ?? 0));
    }
    setBuying(false);
  };

  const handleBuy = async () => {
    if (!user || !lesson) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }

    if (paymentMethod === "bank_transfer" && !receiptFile) {
      toast.error("يجب إرفاق صورة إيصال التحويل البنكي لإتمام الطلب");
      return;
    }

    setBuying(true);
    let receiptUrl = null;

    if (paymentMethod === "bank_transfer" && receiptFile) {
      try {
        const path = `${user.id}/${Date.now()}-${receiptFile.name}`;
        const { publicUrl } = await uploadFileCompat("uploads", path, receiptFile);
        receiptUrl = publicUrl;
      } catch (e) {
        console.error("Receipt upload error:", e);
        toast.error("خطأ في رفع الإيصال");
        setBuying(false);
        return;
      }
    }

    const isInstallment = lesson.lesson_type === "group" && paymentPlan === "installment" && installmentInfo;

    const { data: bookingData, error } = await supabase.from("bookings").insert({
      student_id: user.id,
      lesson_id: lesson.id,
      teacher_id: lesson.teacher_id,
      amount: currentPayAmount,
      payment_method: paymentMethod as any,
      payment_receipt_url: receiptUrl,
      status: "pending",
      ...(isInstallment ? {
        is_installment: true,
        total_installments: installmentInfo!.numInstallments,
        paid_sessions: isInstallment ? installmentInfo!.sessionsPerInstallment : undefined,
      } : {}),
    } as any).select().single();

    if (error || !bookingData) {
      toast.error("حدث خطأ في الحجز");
    } else {
      await supabase.from("invoices").insert({
        booking_id: bookingData.id,
        student_id: user.id,
        teacher_id: lesson.teacher_id,
        lesson_id: lesson.id,
        amount: currentPayAmount,
        payment_method: paymentMethod,
        payment_receipt_url: receiptUrl,
      } as any);

      if (isInstallment) {
        await (supabase.from("course_installments" as any) as any).insert({
          booking_id: bookingData.id,
          installment_number: 1,
          amount: installmentInfo!.amountPerInstallment,
          sessions_unlocked: installmentInfo!.sessionsPerInstallment,
          status: "pending",
        });
      }

      toast.success("تم إرسال الطلب بنجاح! سيتم مراجعة الفاتورة من الإدارة");
      setBuyDialogOpen(false);
      const { data } = await supabase.from("bookings").select("*").eq("lesson_id", id).eq("student_id", user.id);
      setBookings(data ?? []);
    }
    setBuying(false);
  };

  const handleReview = async () => {
    if (!user || !lesson) return;
    const completedBooking = bookings.find((b) => b.status === "completed");
    if (!completedBooking) {
      toast.error("يجب إكمال حصة أولاً لتتمكن من التقييم");
      return;
    }
    const { error } = await supabase.from("reviews").insert({
      booking_id: completedBooking.id,
      student_id: user.id,
      teacher_id: lesson.teacher_id,
      lesson_id: lesson.id,
      rating: reviewRating,
      comment: reviewComment,
    });
    if (error) {
      toast.error("حدث خطأ");
    } else {
      toast.success("شكراً لتقييمك!");
      setReviewComment("");
      const { data } = await supabase.from("reviews").select("*").eq("lesson_id", id);
      if (data) {
        const studentIds = [...new Set(data.map(r => r.student_id))];
        const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds);
        const profileMap: Record<string, string> = {};
        profilesData?.forEach(p => { profileMap[p.user_id] = p.full_name; });
        setReviews(data.map(r => ({ ...r, reviewer_name: profileMap[r.student_id] || "" })));
      }
    }
  };

  if (!lesson) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">جاري التحميل...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="pb-4" dir="rtl">
        {lesson.image_url ? (
          <img src={lesson.image_url} alt={lesson.title} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 gradient-hero" />
        )}

        <div className="px-4 -mt-4 relative">
          <div className="bg-card rounded-xl p-4 border border-border shadow-elevated">
            <h1 className="text-xl font-bold">{lesson.title}</h1>

            <Tabs defaultValue="about" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="about" className="flex-1">عن النشاط</TabsTrigger>
                <TabsTrigger value="sessions" className="flex-1">الجلسات</TabsTrigger>
                <TabsTrigger value="reviews" className="flex-1">التقييم</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="space-y-4 mt-4 text-right">
                {/* Group lesson specific info */}
                {lesson.lesson_type === "group" && (
                  <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-primary flex items-center gap-2 flex-row-reverse">
                      <Users className="h-4 w-4" />
                      معلومات الكورس الجماعي
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 flex-row-reverse">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>العدد المتوقع: {lesson.expected_students} طلاب</span>
                      </div>
                      <div className="flex items-center gap-2 flex-row-reverse">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>المسجلين: {enrolledCount} طالب</span>
                      </div>
                      {lesson.course_start_date && (
                        <div className="flex items-center gap-2 flex-row-reverse">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span>تاريخ البدء: {new Date(lesson.course_start_date).toLocaleDateString("ar")}</span>
                        </div>
                      )}
                      {lesson.total_sessions && (
                        <div className="flex items-center gap-2 flex-row-reverse">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span>عدد الحصص: {lesson.total_sessions}</span>
                        </div>
                      )}
                    </div>
                    {lesson.course_topic_type && (
                      <p className="text-sm text-muted-foreground">نوع الكورس: {lesson.course_topic_type}</p>
                    )}
                    {/* Session schedules */}
                    {sessionSchedules.length > 0 && (
                      <div className="mt-2">
                        <h4 className="font-medium text-sm mb-2">مواعيد الحصص:</h4>
                        <div className="space-y-1">
                          {sessionSchedules.filter(s => s.scheduled_at).map((s) => (
                            <div key={s.id} className="flex items-center gap-2 text-xs bg-background rounded p-2 flex-row-reverse">
                              <CalendarDays className="h-3 w-3 text-muted-foreground" />
                              <span>الحصة {s.session_number}: {new Date(s.scheduled_at).toLocaleString("ar")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {lesson.min_age && lesson.max_age && (
                  <div className="flex items-center gap-2 text-sm flex-row-reverse">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>العمر المتوقع: {lesson.min_age} - {lesson.max_age} سنة</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm flex-row-reverse">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>مدة الحصة: {lesson.duration_minutes} دقيقة</span>
                </div>
                {lesson.description && (
                  <div>
                    <h3 className="font-semibold mb-1">وصف الحصة</h3>
                    <p className="text-sm text-muted-foreground">{lesson.description}</p>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 text-sm flex-row-reverse">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>المعلم: {teacher?.full_name ?? "..."}</span>
                  </div>
                  {teacher?.bio && (
                    <p className="text-sm text-muted-foreground mt-1">{teacher.bio}</p>
                  )}
                </div>
                {lesson.notes && (
                  <div>
                    <h3 className="font-semibold mb-1">ملاحظات</h3>
                    <p className="text-sm text-muted-foreground">{lesson.notes}</p>
                  </div>
                )}
                {lesson.is_online && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-primary flex-row-reverse">
                    <Video className="h-4 w-4" />
                    <span>هذه الحصة أونلاين عبر زوم</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xl font-bold text-primary">{format(lesson.price)}</span>
                  {(() => {
                    // Check if student has an active (non-completed, non-cancelled) booking for this lesson
                    const activeBooking = bookings.find(b => !["completed", "cancelled"].includes(b.status));
                    const allCompleted = bookings.length > 0 && bookings.every(b => ["completed", "cancelled"].includes(b.status));
                    
                    if (activeBooking) {
                      return (
                        <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg text-center">
                          أنت مسجل بالفعل في هذا {lesson.lesson_type === "group" ? "الكورس" : "الدرس"}
                        </div>
                      );
                    }
                    
                    return (
                      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="hero">{allCompleted ? "إعادة الشراء" : "شراء الحصة"}</Button>
                        </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{lesson.lesson_type === "group" ? "شراء الكورس" : "شراء الحصة"}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Installment plan selection for group courses */}
                        {lesson.lesson_type === "group" && installmentInfo && (
                          <div className="space-y-3">
                            <Label className="text-xs font-semibold">خطة الدفع</Label>
                            <div className="space-y-2">
                              <div
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${paymentPlan === "full" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                                onClick={() => setPaymentPlan("full")}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${paymentPlan === "full" ? "border-primary" : "border-muted-foreground"}`}>
                                      {paymentPlan === "full" && <div className="h-2 w-2 rounded-full bg-primary" />}
                                    </div>
                                    <span className="font-medium text-sm">دفع كامل</span>
                                  </div>
                                  <span className="font-bold text-primary">{format(lesson.price)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 mr-6">دفع المبلغ كاملاً والوصول لجميع الحصص ({lesson.total_sessions} حصة)</p>
                              </div>
                              <div
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${paymentPlan === "installment" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                                onClick={() => setPaymentPlan("installment")}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${paymentPlan === "installment" ? "border-primary" : "border-muted-foreground"}`}>
                                      {paymentPlan === "installment" && <div className="h-2 w-2 rounded-full bg-primary" />}
                                    </div>
                                    <span className="font-medium text-sm">دفع بالأقساط ({installmentInfo.numInstallments} دفعات)</span>
                                  </div>
                                  <span className="font-bold text-primary">{format(installmentInfo.amountPerInstallment)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 mr-6">
                                  ادفع {format(installmentInfo.amountPerInstallment)} لكل دفعة وتحصل على {installmentInfo.sessionsPerInstallment} حصة
                                </p>
                                <div className="mt-2 mr-6 p-2 bg-muted/50 rounded text-xs space-y-1">
                                  {Array.from({ length: installmentInfo.numInstallments }).map((_, i) => {
                                    const startSession = i * installmentInfo.sessionsPerInstallment + 1;
                                    const endSession = Math.min((i + 1) * installmentInfo.sessionsPerInstallment, lesson.total_sessions);
                                    return (
                                      <div key={i} className="flex justify-between">
                                        <span>الدفعة {i + 1}: حصة {startSession} - {endSession}</span>
                                        <span className="font-medium">{format(installmentInfo.amountPerInstallment)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground">
                          المبلغ المطلوب: <strong>{format(currentPayAmount)}</strong>
                          {paymentPlan === "installment" && installmentInfo && (
                            <span className="text-xs text-primary mr-2">(الدفعة الأولى من {installmentInfo.numInstallments})</span>
                          )}
                        </p>
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                          {paymentSettings?.paypal?.enabled && (
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="paypal" id="paypal" />
                              <Label htmlFor="paypal" className="flex items-center gap-2">
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
                              <RadioGroupItem value="bank_transfer" id="bank" />
                              <Label htmlFor="bank">تحويل بنكي</Label>
                            </div>
                          )}
                        </RadioGroup>
                        {paymentMethod === "paypal" && paymentSettings?.paypal?.client_id && (
                          <div className="space-y-3 paypal-card-only">
                            <style>{`
                              .paypal-card-only .paypal-powered-by,
                              .paypal-card-only [data-funding-source] .paypal-powered-by,
                              .paypal-card-only .powered-by-paypal,
                              .paypal-card-only [class*="powered"],
                              .paypal-card-only [class*="Powered"] {
                                display: none !important;
                              }
                              .paypal-card-only iframe[title*="address"],
                              .paypal-card-only [data-field="postal"],
                              .paypal-card-only [data-field="name"],
                              .paypal-card-only [data-field="billingAddress"] {
                                display: none !important;
                              }
                            `}</style>
                            <PayPalScriptProvider
                              key={`paypal-${paymentSettings.paypal.sandbox ? "sandbox" : "live"}-${paymentSettings.paypal.client_id.slice(-6)}`}
                              options={{
                                clientId: paymentSettings.paypal.client_id,
                                currency: "USD",
                                intent: "capture",
                                components: "buttons",
                                dataNamespace: "paypal_sdk",
                              }}
                            >
                              <PayPalButtons
                                fundingSource="card"
                                style={{ layout: "vertical", shape: "rect", label: "pay", color: "black", tagline: false }}
                                disabled={buying}
                                createOrder={(_data: any, actions: any) => {
                                  return actions.order.create({
                                    intent: "CAPTURE",
                                    purchase_units: [{
                                      amount: { value: String(currentPayAmount), currency_code: "USD" },
                                      description: lesson.title,
                                    }],
                                    application_context: {
                                      shipping_preference: "NO_SHIPPING",
                                    },
                                  });
                                }}
                                onApprove={async (_data: any, actions: any) => {
                                  try {
                                    const order = await actions.order?.capture();
                                    if (order?.status === "COMPLETED") {
                                      await handlePayPalSuccess(order);
                                    } else {
                                      toast.error("لم يتم إكمال الدفع");
                                    }
                                  } catch (err) {
                                    console.error("PayPal approve error:", err);
                                    toast.error("حدث خطأ أثناء معالجة الدفع");
                                  }
                                }}
                                onError={(err: any) => {
                                  console.error("PayPal button error:", err);
                                  toast.error("حدث خطأ في PayPal");
                                }}
                              />
                            </PayPalScriptProvider>
                            {paymentSettings.paypal.sandbox && (
                              <p className="text-[10px] text-center text-warning bg-warning/10 rounded p-1">⚠️ وضع الاختبار (Sandbox)</p>
                            )}
                          </div>
                        )}
                        {paymentMethod === "paypal" && !paymentSettings?.paypal?.client_id && (
                          <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground text-center">
                            طريقة الدفع عبر PayPal غير مكتملة الإعداد حالياً
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
                              <Input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className="mt-1" />
                            </div>
                          </div>
                        )}
                        {paymentMethod === "bank_transfer" && (
                          <Button onClick={handleBuy} disabled={buying} className="w-full" variant="hero">
                            {buying ? "جارٍ التحميل..." : "إتمام الشراء"}
                          </Button>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                    );
                  })()}
                </div>
              </TabsContent>

              <TabsContent value="sessions" className="mt-4">
                {bookings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد جلسات محجوزة</p>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((b) => (
                      <div key={b.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {b.status === "pending" ? "في الانتظار" :
                             b.status === "accepted" ? "مقبول" :
                             b.status === "scheduled" ? "مجدول" :
                             b.status === "completed" ? "مكتمل" : "ملغي"}
                          </span>
                          {b.scheduled_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(b.scheduled_at).toLocaleString("ar")}
                            </span>
                          )}
                        </div>
                        {b.zoom_join_url && b.status === "scheduled" && (
                          <a href={b.zoom_join_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="hero" className="mt-2 w-full">
                              <Video className="h-4 w-4 ml-2" />
                              دخول الحصة
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <div className="space-y-3 mb-6">
                  {reviews.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد تقييمات بعد</p>
                  ) : reviews.map((r) => (
                    <div key={r.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < r.rating ? "text-warning fill-current" : "text-muted"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{(r as any).reviewer_name}</span>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>

                {user && bookings.some((b) => b.status === "completed") && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <h3 className="font-semibold text-sm">أضف تقييمك</h3>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button key={i} onClick={() => setReviewRating(i + 1)}>
                          <Star className={`h-6 w-6 ${i < reviewRating ? "text-warning fill-current" : "text-muted"}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="اكتب تعليقك..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                    <Button onClick={handleReview} variant="hero" size="sm">إرسال التقييم</Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
