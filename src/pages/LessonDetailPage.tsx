import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Star, Clock, User, AlertTriangle, Video } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("paypal");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("lessons").select("*").eq("id", id).single()
      .then(({ data }) => {
        setLesson(data);
        if (data) {
          supabase.from("profiles").select("*").eq("user_id", data.teacher_id).single()
            .then(({ data: p }) => setTeacher(p));
        }
      });

    supabase.from("reviews").select("*, profiles:student_id(full_name)").eq("lesson_id", id)
      .then(({ data }) => setReviews(data ?? []));

    if (user) {
      supabase.from("bookings").select("*").eq("lesson_id", id).eq("student_id", user.id)
        .then(({ data }) => setBookings(data ?? []));
    }
  }, [id, user]);

  const handleBuy = async () => {
    if (!user || !lesson) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }

    setBuying(true);
    let receiptUrl = null;

    if (paymentMethod === "bank_transfer" && receiptFile) {
      const path = `${user.id}/${Date.now()}-${receiptFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, receiptFile);
      if (uploadError) {
        toast.error("خطأ في رفع الإيصال");
        setBuying(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
      receiptUrl = publicUrl;
    }

    const { error } = await supabase.from("bookings").insert({
      student_id: user.id,
      lesson_id: lesson.id,
      teacher_id: lesson.teacher_id,
      amount: lesson.price,
      payment_method: paymentMethod as any,
      payment_receipt_url: receiptUrl,
      status: "pending",
    });

    if (error) {
      toast.error("حدث خطأ في الحجز");
    } else {
      toast.success("تم الحجز بنجاح! سيقوم المعلم بتأكيد الموعد");
      setBuyDialogOpen(false);
      // Refresh bookings
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
      const { data } = await supabase.from("reviews").select("*, profiles:student_id(full_name)").eq("lesson_id", id);
      setReviews(data ?? []);
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

              <TabsContent value="about" className="space-y-4 mt-4">
                {lesson.min_age && lesson.max_age && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>العمر المتوقع: {lesson.min_age} - {lesson.max_age} سنة</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
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
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>المعلم: {teacher?.full_name ?? "..."}</span>
                  </div>
                  {teacher?.bio && (
                    <p className="text-sm text-muted-foreground mt-1 mr-6">{teacher.bio}</p>
                  )}
                </div>
                {lesson.notes && (
                  <div>
                    <h3 className="font-semibold mb-1">ملاحظات</h3>
                    <p className="text-sm text-muted-foreground">{lesson.notes}</p>
                  </div>
                )}
                {lesson.is_online && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-primary">
                    <Video className="h-4 w-4" />
                    <span>هذه الحصة أونلاين عبر زوم</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xl font-bold text-primary">{lesson.price} ر.س</span>
                  <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="hero">شراء الحصة</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>شراء الحصة</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">المبلغ: <strong>{lesson.price} ر.س</strong></p>
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="paypal" id="paypal" />
                            <Label htmlFor="paypal">PayPal</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="bank_transfer" id="bank" />
                            <Label htmlFor="bank">تحويل بنكي</Label>
                          </div>
                        </RadioGroup>
                        {paymentMethod === "bank_transfer" && (
                          <div>
                            <Label>إرفاق صورة الإيصال</Label>
                            <Input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className="mt-1" />
                          </div>
                        )}
                        <Button onClick={handleBuy} disabled={buying} className="w-full" variant="hero">
                          {buying ? "جارٍ التحميل..." : "إتمام الشراء"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
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
                        <span className="text-xs text-muted-foreground">{(r as any).profiles?.full_name}</span>
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
