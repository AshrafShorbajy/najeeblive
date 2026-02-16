import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Calendar, Eye, Clock, CheckCircle, XCircle, ExternalLink, Image, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/CurrencyContext";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  accepted: { label: "مقبول", color: "bg-blue-100 text-blue-800 border-blue-300" },
  scheduled: { label: "مجدول", color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800 border-green-300" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-800 border-red-300" },
};

export default function OrdersManagement() {
  const { format } = useCurrency();
  const [bookings, setBookings] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [lessons, setLessons] = useState<Record<string, any>>({});
  const [relatedInvoicesMap, setRelatedInvoicesMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    const { data: bData } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    const allBookings = bData ?? [];
    setBookings(allBookings);

    // Collect unique user IDs and lesson IDs
    const userIds = [...new Set(allBookings.flatMap(b => [b.student_id, b.teacher_id]))];
    const lessonIds = [...new Set(allBookings.map(b => b.lesson_id))];

    // Fetch profiles
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      const pMap: Record<string, any> = {};
      pData?.forEach(p => { pMap[p.user_id] = p; });
      setProfiles(pMap);
    }

    // Fetch lessons
    if (lessonIds.length > 0) {
      const { data: lData } = await supabase
        .from("lessons")
        .select("id, title, price, duration_minutes, lesson_type, total_sessions, expected_students")
        .in("id", lessonIds);
      const lMap: Record<string, any> = {};
      lData?.forEach(l => { lMap[l.id] = l; });
      setLessons(lMap);
    }

    // Fetch related invoices for all bookings
    const bookingIds = allBookings.map(b => b.id);
    if (bookingIds.length > 0) {
      const { data: invData } = await supabase
        .from("invoices")
        .select("id, booking_id, amount, status, payment_method, created_at")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: true });
      const riMap: Record<string, any[]> = {};
      (invData ?? []).forEach((inv: any) => {
        if (!riMap[inv.booking_id]) riMap[inv.booking_id] = [];
        riMap[inv.booking_id].push(inv);
      });
      setRelatedInvoicesMap(riMap);
    }

    setLoading(false);
  };

  const handleUpdateBooking = async () => {
    if (!selectedBooking) return;
    setUpdating(true);

    const updateData: any = {};
    if (newStatus) updateData.status = newStatus;
    if (scheduleDate) updateData.scheduled_at = new Date(scheduleDate).toISOString();

    if (Object.keys(updateData).length === 0) {
      toast.error("لا توجد تغييرات");
      setUpdating(false);
      return;
    }

    // If changing to completed, clear zoom URLs
    if (newStatus === "completed") {
      updateData.zoom_join_url = null;
      updateData.zoom_start_url = null;
      updateData.zoom_meeting_id = null;
    }

    const { error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", selectedBooking.id);

    if (error) {
      toast.error("فشل تحديث الطلب");
    } else {
      toast.success("تم تحديث الطلب بنجاح");
      setSelectedBooking(null);
      setScheduleDate("");
      setNewStatus("");
      fetchBookings();
    }
    setUpdating(false);
  };

  const filtered = bookings.filter(b => {
    const studentName = profiles[b.student_id]?.full_name || "";
    const teacherName = profiles[b.teacher_id]?.full_name || "";
    const lessonTitle = lessons[b.lesson_id]?.title || "";
    const matchesSearch = !search ||
      studentName.includes(search) ||
      teacherName.includes(search) ||
      lessonTitle.includes(search);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">جارٍ تحميل الطلبات...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الحصة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="pending">في الانتظار</SelectItem>
            <SelectItem value="scheduled">مجدول</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
            <SelectItem value="accepted">مقبول</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} طلب</p>

      {/* Orders List */}
      <div className="space-y-2">
        {filtered.map(b => {
          const student = profiles[b.student_id];
          const teacher = profiles[b.teacher_id];
          const lesson = lessons[b.lesson_id];
          const status = STATUS_MAP[b.status] || { label: b.status, color: "bg-muted" };
          const isGroup = lesson?.lesson_type === "group";
          const isInstallment = b.is_installment;
          const relatedInvoices = relatedInvoicesMap[b.id] || [];

          return (
            <div
              key={b.id}
              className="bg-card rounded-xl p-4 border border-border hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedBooking(b);
                setNewStatus(b.status);
                setScheduleDate(b.scheduled_at ? new Date(b.scheduled_at).toISOString().slice(0, 16) : "");
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{lesson?.title || "حصة محذوفة"}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    {isGroup && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-purple-100 text-purple-800 border-purple-300">
                        كورس جماعي
                      </span>
                    )}
                    {isInstallment && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-indigo-100 text-indigo-800 border-indigo-300">
                        أقساط
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>الطالب: {student?.full_name || "—"}</span>
                    <span>المعلم: {teacher?.full_name || "—"}</span>
                    {isInstallment && relatedInvoices.length > 0 && (
                      <span className="text-indigo-600 font-medium">{relatedInvoices.filter((i: any) => i.status === "paid").length}/{b.total_installments || "?"} دفعات</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{format(b.amount)}</span>
                    <span>{b.payment_method === "paypal" ? "PayPal" : b.payment_method === "bank_transfer" ? "تحويل بنكي" : "—"}</span>
                    <span>{new Date(b.created_at).toLocaleDateString("ar")}</span>
                  </div>
                  {b.scheduled_at && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(b.scheduled_at).toLocaleString("ar")}</span>
                    </div>
                  )}
                </div>
                <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">لا توجد طلبات</p>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={open => { if (!open) { setSelectedBooking(null); setNewStatus(""); setScheduleDate(""); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedBooking && (() => {
            const b = selectedBooking;
            const student = profiles[b.student_id];
            const teacher = profiles[b.teacher_id];
            const lesson = lessons[b.lesson_id];
            const status = STATUS_MAP[b.status] || { label: b.status, color: "bg-muted" };
            const isGroup = lesson?.lesson_type === "group";
            const isInstallment = b.is_installment;
            const relatedInvoices = (relatedInvoicesMap[b.id] || []);
            const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
              pending: { label: "بانتظار المراجعة", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
              paid: { label: "مدفوع", color: "bg-green-100 text-green-800 border-green-300" },
              rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 border-red-300" },
            };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-right">تفاصيل الطلب</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Lesson Info */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{lesson?.title || "حصة محذوفة"}</p>
                      {isGroup && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-purple-100 text-purple-800 border-purple-300">
                          كورس جماعي
                        </span>
                      )}
                      {isInstallment && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-indigo-100 text-indigo-800 border-indigo-300">
                          أقساط
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{lesson?.duration_minutes} دقيقة</span>
                      <span>{format(b.amount)}</span>
                      <span>{lesson?.lesson_type === "tutoring" ? "دروس خصوصية" : lesson?.lesson_type === "skills" ? "مهارات" : lesson?.lesson_type === "group" ? "كورس جماعي" : "مراجعة حقيبة"}</span>
                    </div>
                    {isGroup && (
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1 pt-1 border-t border-border">
                        {lesson?.total_sessions && <span>عدد الحصص: {lesson.total_sessions}</span>}
                        {lesson?.expected_students && <span>العدد المتوقع: {lesson.expected_students} طالب</span>}
                        {lesson?.price && <span>سعر الكورس: {format(lesson.price)}</span>}
                        {isInstallment && <span>الحصص المدفوعة: {b.paid_sessions || 0}/{lesson?.total_sessions || "?"}</span>}
                      </div>
                    )}
                  </div>

                  {/* Participants */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground mb-1">الطالب</p>
                      <p className="font-medium text-xs">{student?.full_name || "—"}</p>
                      {student?.phone && <p className="text-[10px] text-muted-foreground" dir="ltr">{student.phone}</p>}
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground mb-1">المعلم</p>
                      <p className="font-medium text-xs">{teacher?.full_name || "—"}</p>
                      {teacher?.phone && <p className="text-[10px] text-muted-foreground" dir="ltr">{teacher.phone}</p>}
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium">معلومات الدفع</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-muted px-2 py-1 rounded">
                        {b.payment_method === "paypal" ? "PayPal" : b.payment_method === "bank_transfer" ? "تحويل بنكي" : "غير محدد"}
                      </span>
                      <span className="bg-muted px-2 py-1 rounded">{format(b.amount)}</span>
                    </div>
                    {b.payment_receipt_url && (
                      <a href={b.payment_receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Image className="h-3 w-3" />
                        عرض إيصال الدفع
                      </a>
                    )}
                  </div>

                  {/* Installment Payment History */}
                  {relatedInvoices.length > 0 && (isInstallment || relatedInvoices.length > 1) && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-indigo-800">سجل الدفعات ({relatedInvoices.length} دفعة)</p>
                      <div className="space-y-1.5">
                        {relatedInvoices.map((ri: any, idx: number) => {
                          const riStatus = INVOICE_STATUS[ri.status] || { label: ri.status, color: "bg-muted" };
                          return (
                            <div key={ri.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/60">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-indigo-700">دفعة {idx + 1}</span>
                                <span className="text-muted-foreground">{ri.payment_method === "paypal" ? "PayPal" : "تحويل بنكي"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{format(ri.amount)}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${riStatus.color}`}>{riStatus.label}</span>
                                <span className="text-muted-foreground">{new Date(ri.created_at).toLocaleDateString("ar")}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-indigo-200 text-xs">
                        <span className="font-semibold text-indigo-800">إجمالي المدفوع</span>
                        <span className="font-bold text-indigo-900">
                          {format(relatedInvoices.filter((ri: any) => ri.status === "paid").reduce((sum: number, ri: any) => sum + ri.amount, 0))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Zoom Links */}
                  {(b.zoom_join_url || b.zoom_start_url) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">روابط الحصة</p>
                      <div className="flex flex-col gap-1">
                        {b.zoom_start_url && (
                          <a href={b.zoom_start_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            رابط بدء الحصة (المعلم)
                          </a>
                        )}
                        {b.zoom_join_url && (
                          <a href={b.zoom_join_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            رابط الانضمام (الطالب)
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current Status */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium">الحالة الحالية</p>
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>تاريخ الإنشاء: {new Date(b.created_at).toLocaleString("ar")}</p>
                    {b.scheduled_at && <p>الموعد المجدول: {new Date(b.scheduled_at).toLocaleString("ar")}</p>}
                  </div>

                  {/* Actions */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <div>
                      <Label className="text-xs">تغيير الحالة</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">في الانتظار</SelectItem>
                          <SelectItem value="accepted">مقبول</SelectItem>
                          <SelectItem value="scheduled">مجدول</SelectItem>
                          <SelectItem value="completed">مكتمل</SelectItem>
                          <SelectItem value="cancelled">ملغي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">جدولة الموعد</Label>
                      <Input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleUpdateBooking} disabled={updating} className="w-full" variant="hero">
                      {updating ? "جارٍ التحديث..." : "حفظ التغييرات"}
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
