import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Eye, FileText, CheckCircle, XCircle, Image, Clock, Printer } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

const INVOICE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار المراجعة", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  paid: { label: "مدفوع", color: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 border-red-300" },
};

export default function InvoicesManagement() {
  const { format } = useCurrency();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [lessonsMap, setLessonsMap] = useState<Record<string, any>>({});
  const [bookingsMap, setBookingsMap] = useState<Record<string, any>>({});
  const [relatedInvoicesMap, setRelatedInvoicesMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterDay, setFilterDay] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvoices();
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-user-emails");
      if (data?.emails) setEmails(data.emails);
    } catch {}
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const { data: invData } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    const allInvoices = invData ?? [];
    setInvoices(allInvoices);

    const userIds = [...new Set(allInvoices.flatMap(i => [i.student_id, i.teacher_id]))];
    const lessonIds = [...new Set(allInvoices.map(i => i.lesson_id))];
    const bookingIds = [...new Set(allInvoices.map(i => i.booking_id))];

    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      const pMap: Record<string, any> = {};
      pData?.forEach(p => { pMap[p.user_id] = p; });
      setProfiles(pMap);
    }

    if (lessonIds.length > 0) {
      const { data: lData } = await supabase
        .from("lessons")
        .select("id, title, price, duration_minutes, lesson_type, total_sessions, expected_students, curricula(name), grade_levels(name), subjects(name)")
        .in("id", lessonIds);
      const lMap: Record<string, any> = {};
      lData?.forEach(l => { lMap[l.id] = l; });
      setLessonsMap(lMap);
    }

    // Fetch bookings to detect installments
    if (bookingIds.length > 0) {
      const { data: bData } = await supabase
        .from("bookings")
        .select("id, is_installment, total_installments, paid_sessions, status, amount")
        .in("id", bookingIds);
      const bMap: Record<string, any> = {};
      bData?.forEach(b => { bMap[b.id] = b; });
      setBookingsMap(bMap);
    }

    // Build related invoices map (group by booking_id)
    const riMap: Record<string, any[]> = {};
    allInvoices.forEach(inv => {
      if (!riMap[inv.booking_id]) riMap[inv.booking_id] = [];
      riMap[inv.booking_id].push(inv);
    });
    setRelatedInvoicesMap(riMap);

    setLoading(false);
  };

  const handleApprove = async () => {
    if (!selectedInvoice) return;
    setUpdating(true);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid" as any, admin_notes: adminNotes || null })
      .eq("id", selectedInvoice.id);
    if (error) {
      toast.error("فشل تحديث الفاتورة");
    } else {
      // Check if this is a group lesson - if so, set to "scheduled" directly
      const lesson = lessonsMap[selectedInvoice.lesson_id];
      const booking = bookingsMap[selectedInvoice.booking_id];
      const newStatus = lesson?.lesson_type === "group" ? "scheduled" : "accepted";

      // For installment invoices, update paid_sessions and mark course_installment as paid
      const bookingUpdate: any = { status: newStatus as any };
      if (booking?.is_installment && lesson?.lesson_type === "group") {
        // Calculate sessions per installment
        const totalSessions = lesson.total_sessions || 0;
        let numInstallments = 2;
        if (totalSessions >= 11 && totalSessions <= 20) numInstallments = 4;
        else if (totalSessions >= 21 && totalSessions <= 50) numInstallments = 6;
        const sessionsPerInstallment = Math.ceil(totalSessions / numInstallments);

        const newPaidSessions = (booking.paid_sessions || 0) + sessionsPerInstallment;
        bookingUpdate.paid_sessions = newPaidSessions;

        // Mark the corresponding course_installment as paid
        const { data: pendingInstallments } = await (supabase.from("course_installments" as any) as any)
          .select("id")
          .eq("booking_id", selectedInvoice.booking_id)
          .eq("status", "pending")
          .order("installment_number")
          .limit(1);
        
        if (pendingInstallments && pendingInstallments.length > 0) {
          await (supabase.from("course_installments" as any) as any)
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", pendingInstallments[0].id);
        }
      }

      await supabase
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", selectedInvoice.booking_id);

      // Auto-create conversation for teacher and student
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("booking_id", selectedInvoice.booking_id)
        .maybeSingle();
      
      if (!existingConv) {
        await supabase.from("conversations").insert({
          student_id: selectedInvoice.student_id,
          teacher_id: selectedInvoice.teacher_id,
          booking_id: selectedInvoice.booking_id,
        });
      }

      const msg = lesson?.lesson_type === "group"
        ? "تم اعتماد الفاتورة وتسجيل الطالب في الكورس الجماعي"
        : "تم اعتماد الفاتورة وإصدار الطلب للمعلم وفتح المحادثة";
      toast.success(msg);
      setSelectedInvoice(null);
      setAdminNotes("");
      fetchInvoices();
    }
    setUpdating(false);
  };

  const handleReject = async () => {
    if (!selectedInvoice) return;
    if (!adminNotes.trim()) {
      toast.error("يرجى كتابة سبب الرفض في الملاحظات");
      return;
    }
    setUpdating(true);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "rejected" as any, admin_notes: adminNotes })
      .eq("id", selectedInvoice.id);
    if (error) {
      toast.error("فشل تحديث الفاتورة");
    } else {
      await supabase
        .from("bookings")
        .update({ status: "cancelled" as any })
        .eq("id", selectedInvoice.booking_id);
      toast.success("تم رفض الفاتورة");
      setSelectedInvoice(null);
      setAdminNotes("");
      fetchInvoices();
    }
    setUpdating(false);
  };

  const handlePrint = (inv: any) => {
    setPrintInvoice(inv);
    setTimeout(() => {
      if (printRef.current) {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        const content = printRef.current.innerHTML;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>فاتورة #${inv.id.slice(0, 8)}</title>
            <style>
              @page { size: A4; margin: 20mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
              .invoice-page { width: 100%; max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
              .header h1 { font-size: 28px; color: #2563eb; }
              .header .invoice-num { font-size: 13px; color: #666; }
              .section { margin-bottom: 20px; }
              .section-title { font-size: 15px; font-weight: 700; color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 10px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
              .info-row { display: flex; gap: 8px; }
              .info-label { color: #666; min-width: 100px; }
              .info-value { font-weight: 600; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; }
              th, td { border: 1px solid #e5e7eb; padding: 10px 14px; text-align: right; }
              th { background: #f0f4ff; font-weight: 700; color: #2563eb; }
              .total-row td { font-weight: 700; font-size: 16px; background: #f8fafc; }
              .status-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
              .status-paid { background: #dcfce7; color: #166534; }
              .status-pending { background: #fef9c3; color: #854d0e; }
              .status-rejected { background: #fee2e2; color: #991b1b; }
              .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
              @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            ${content}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 300);
      }
      setPrintInvoice(null);
    }, 100);
  };

  const filtered = invoices.filter(inv => {
    const studentName = profiles[inv.student_id]?.full_name || "";
    const teacherName = profiles[inv.teacher_id]?.full_name || "";
    const lessonTitle = lessonsMap[inv.lesson_id]?.title || "";
    const matchesSearch = !search ||
      studentName.includes(search) ||
      teacherName.includes(search) ||
      lessonTitle.includes(search);
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    const invDate = new Date(inv.created_at);
    const matchesDay = !filterDay || invDate.getDate() === parseInt(filterDay);
    const matchesMonth = filterMonth === "all" || (invDate.getMonth() + 1) === parseInt(filterMonth);
    const matchesYear = filterYear === "all" || invDate.getFullYear() === parseInt(filterYear);

    return matchesSearch && matchesStatus && matchesDay && matchesMonth && matchesYear;
  });

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">جارٍ تحميل الفواتير...</div>;
  }

  const renderPrintInvoice = (inv: any) => {
    const student = profiles[inv.student_id];
    const teacher = profiles[inv.teacher_id];
    const lesson = lessonsMap[inv.lesson_id];
    const studentEmail = emails[inv.student_id] || "—";
    const status = INVOICE_STATUS_MAP[inv.status] || { label: inv.status };
    const statusClass = inv.status === "paid" ? "status-paid" : inv.status === "rejected" ? "status-rejected" : "status-pending";

    return (
      <div className="invoice-page">
        <div className="header">
          <div>
            <h1>فاتورة</h1>
            <div className="invoice-num">رقم الفاتورة: {inv.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "13px", color: "#666" }}>التاريخ: {new Date(inv.created_at).toLocaleDateString("ar")}</div>
            <span className={`status-badge ${statusClass}`}>{status.label}</span>
          </div>
        </div>

        <div className="section">
          <div className="section-title">معلومات الطالب</div>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">الاسم:</span>
              <span className="info-value">{student?.full_name || "—"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">البريد الإلكتروني:</span>
              <span className="info-value" dir="ltr">{studentEmail}</span>
            </div>
            <div className="info-row">
              <span className="info-label">رقم الهاتف:</span>
              <span className="info-value" dir="ltr">{student?.phone || "—"}</span>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">معلومات المعلم</div>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">الاسم:</span>
              <span className="info-value">{teacher?.full_name || "—"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">رقم الهاتف:</span>
              <span className="info-value" dir="ltr">{teacher?.phone || "—"}</span>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">تفاصيل الحصة</div>
          <table>
            <thead>
              <tr>
                <th>الحصة</th>
                <th>النوع</th>
                <th>المدة</th>
                <th>المنهج</th>
                <th>المادة</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{lesson?.title || "—"}</td>
                <td>{lesson?.lesson_type === "tutoring" ? "دروس خصوصية" : lesson?.lesson_type === "skills" ? "مهارات" : "مراجعة حقيبة"}</td>
                <td>{lesson?.duration_minutes || "—"} دقيقة</td>
                <td>{lesson?.curricula?.name || "—"}</td>
                <td>{lesson?.subjects?.name || "—"}</td>
                <td>{format(inv.amount)}</td>
              </tr>
              <tr className="total-row">
                <td colSpan={5}>الإجمالي</td>
                <td>{format(inv.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title">معلومات الدفع</div>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">طريقة الدفع:</span>
              <span className="info-value">{inv.payment_method === "paypal" ? "PayPal" : inv.payment_method === "bank_transfer" ? "تحويل بنكي" : "غير محدد"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">تاريخ الفاتورة:</span>
              <span className="info-value">{new Date(inv.created_at).toLocaleString("ar")}</span>
            </div>
          </div>
        </div>

        {inv.admin_notes && (
          <div className="section">
            <div className="section-title">ملاحظات</div>
            <p>{inv.admin_notes}</p>
          </div>
        )}

        <div className="footer">
          تم إصدار هذه الفاتورة إلكترونياً
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-yellow-700">{invoices.filter(i => i.status === "pending").length}</p>
          <p className="text-[10px] text-yellow-600">بانتظار المراجعة</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-700">{invoices.filter(i => i.status === "paid").length}</p>
          <p className="text-[10px] text-green-600">مدفوعة</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-red-700">{invoices.filter(i => i.status === "rejected").length}</p>
          <p className="text-[10px] text-red-600">مرفوضة</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الحصة..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">بانتظار المراجعة</SelectItem>
              <SelectItem value="paid">مدفوع</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="number"
            min="1"
            max="31"
            placeholder="اليوم (1-31)"
            value={filterDay}
            onChange={e => setFilterDay(e.target.value)}
            className="w-full sm:w-32"
          />
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="الشهر" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأشهر</SelectItem>
              {["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"].map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السنوات</SelectItem>
              {Array.from(new Set(invoices.map(i => new Date(i.created_at).getFullYear()))).sort((a, b) => b - a).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} فاتورة</p>

      {/* Invoices List */}
      <div className="space-y-2">
        {filtered.map(inv => {
          const student = profiles[inv.student_id];
          const teacher = profiles[inv.teacher_id];
          const lesson = lessonsMap[inv.lesson_id];
          const booking = bookingsMap[inv.booking_id];
          const status = INVOICE_STATUS_MAP[inv.status] || { label: inv.status, color: "bg-muted" };
          const isInstallment = booking?.is_installment || lesson?.lesson_type === "group";
          const relatedCount = (relatedInvoicesMap[inv.booking_id] || []).length;

          return (
            <div
              key={inv.id}
              className="bg-card rounded-xl p-4 border border-border hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => { setSelectedInvoice(inv); setAdminNotes(inv.admin_notes || ""); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <p className="font-semibold text-sm">{lesson?.title || "حصة محذوفة"}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    {isInstallment && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-indigo-100 text-indigo-800 border-indigo-300">
                        دفعة قسط
                      </span>
                    )}
                    {lesson?.lesson_type === "group" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-purple-100 text-purple-800 border-purple-300">
                        كورس جماعي
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>الطالب: {student?.full_name || "—"}</span>
                    <span>المعلم: {teacher?.full_name || "—"}</span>
                    {isInstallment && relatedCount > 1 && (
                      <span className="text-indigo-600 font-medium">{relatedCount} دفعات</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{format(inv.amount)}</span>
                    <span>{inv.payment_method === "paypal" ? "PayPal" : inv.payment_method === "bank_transfer" ? "تحويل بنكي" : "—"}</span>
                    <span>{new Date(inv.created_at).toLocaleDateString("ar")}</span>
                  </div>
                </div>
                {inv.status === "pending" && <Clock className="h-4 w-4 text-yellow-500 shrink-0 mt-1 animate-pulse" />}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">لا توجد فواتير</p>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={open => { if (!open) { setSelectedInvoice(null); setAdminNotes(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (() => {
            const inv = selectedInvoice;
            const student = profiles[inv.student_id];
            const teacher = profiles[inv.teacher_id];
            const lesson = lessonsMap[inv.lesson_id];
            const booking = bookingsMap[inv.booking_id];
            const studentEmail = emails[inv.student_id] || "—";
            const status = INVOICE_STATUS_MAP[inv.status] || { label: inv.status, color: "bg-muted" };
            const isInstallment = booking?.is_installment || lesson?.lesson_type === "group";
            const relatedInvoices = (relatedInvoicesMap[inv.booking_id] || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-right flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    فاتورة #{inv.id.slice(0, 8)}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">حالة الفاتورة</span>
                    <span className={`text-xs px-3 py-1 rounded-full border font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Student Info */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">معلومات الطالب</p>
                    <p className="text-sm font-medium">{student?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{studentEmail}</p>
                    {student?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{student.phone}</p>}
                  </div>

                  {/* Teacher Info */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">معلومات المعلم</p>
                    <p className="text-sm font-medium">{teacher?.full_name || "—"}</p>
                    {teacher?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{teacher.phone}</p>}
                  </div>

                  {/* Lesson Info */}
                  <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">تفاصيل الحصة</p>
                      {isInstallment && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-indigo-100 text-indigo-800 border-indigo-300">
                          دفعة قسط
                        </span>
                      )}
                      {lesson?.lesson_type === "group" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-purple-100 text-purple-800 border-purple-300">
                          كورس جماعي
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{lesson?.title || "—"}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">النوع: </span>
                        <span className="font-medium">
                          {lesson?.lesson_type === "tutoring" ? "دروس خصوصية" : lesson?.lesson_type === "skills" ? "مهارات" : lesson?.lesson_type === "group" ? "كورس جماعي" : "مراجعة حقيبة"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">المدة: </span>
                        <span className="font-medium">{lesson?.duration_minutes} دقيقة</span>
                      </div>
                      {lesson?.lesson_type === "group" && lesson?.total_sessions && (
                        <div>
                          <span className="text-muted-foreground">عدد الحصص: </span>
                          <span className="font-medium">{lesson.total_sessions} حصة</span>
                        </div>
                      )}
                      {lesson?.lesson_type === "group" && lesson?.expected_students && (
                        <div>
                          <span className="text-muted-foreground">العدد المتوقع: </span>
                          <span className="font-medium">{lesson.expected_students} طالب</span>
                        </div>
                      )}
                      {lesson?.lesson_type === "group" && lesson?.price && (
                        <div>
                          <span className="text-muted-foreground">سعر الكورس الكامل: </span>
                          <span className="font-medium">{format(lesson.price)}</span>
                        </div>
                      )}
                      {lesson?.curricula?.name && (
                        <div>
                          <span className="text-muted-foreground">المنهج: </span>
                          <span className="font-medium">{lesson.curricula.name}</span>
                        </div>
                      )}
                      {lesson?.grade_levels?.name && (
                        <div>
                          <span className="text-muted-foreground">الصف: </span>
                          <span className="font-medium">{lesson.grade_levels.name}</span>
                        </div>
                      )}
                      {lesson?.subjects?.name && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">المادة: </span>
                          <span className="font-medium">{lesson.subjects.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Installment Payment History */}
                  {isInstallment && relatedInvoices.length > 1 && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-indigo-800">سجل الدفعات ({relatedInvoices.length} دفعة)</p>
                      <div className="space-y-1.5">
                        {relatedInvoices.map((ri: any, idx: number) => {
                          const riStatus = INVOICE_STATUS_MAP[ri.status] || { label: ri.status, color: "bg-muted" };
                          const isCurrent = ri.id === inv.id;
                          return (
                            <div
                              key={ri.id}
                              className={`flex items-center justify-between text-xs p-2 rounded-lg ${isCurrent ? "bg-indigo-100 border border-indigo-300" : "bg-white/60"}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-indigo-700">دفعة {idx + 1}</span>
                                {isCurrent && <span className="text-[9px] px-1.5 py-0.5 bg-indigo-200 text-indigo-800 rounded">الحالية</span>}
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

                  {/* Payment Info */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">معلومات الدفع</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">المبلغ</span>
                      <span className="text-lg font-bold text-primary">{format(inv.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">طريقة الدفع</span>
                      <span>{inv.payment_method === "paypal" ? "PayPal" : inv.payment_method === "bank_transfer" ? "تحويل بنكي" : "غير محدد"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">تاريخ الفاتورة</span>
                      <span>{new Date(inv.created_at).toLocaleString("ar")}</span>
                    </div>
                  </div>

                  {/* Receipt */}
                  {inv.payment_receipt_url && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Image className="h-3 w-3" />
                        إيصال الدفع
                      </p>
                      <div
                        className="border border-border rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setReceiptPreview(inv.payment_receipt_url)}
                      >
                        <img src={inv.payment_receipt_url} alt="إيصال الدفع" className="w-full max-h-48 object-contain bg-muted" />
                      </div>
                      <a
                        href={inv.payment_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        فتح الصورة في تبويب جديد
                      </a>
                    </div>
                  )}

                  {/* Admin Notes */}
                  {inv.status === "pending" ? (
                    <div className="space-y-2">
                      <Label className="text-xs">ملاحظات الأدمن</Label>
                      <Textarea
                        placeholder="أضف ملاحظات (مطلوب في حالة الرفض)..."
                        value={adminNotes}
                        onChange={e => setAdminNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  ) : inv.admin_notes && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات الأدمن</p>
                      <p className="text-sm">{inv.admin_notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button
                      onClick={(e) => { e.stopPropagation(); handlePrint(inv); }}
                      variant="outline"
                      size="sm"
                    >
                      <Printer className="h-4 w-4 ml-1" />
                      طباعة الفاتورة
                    </Button>
                    {inv.status === "pending" && (
                      <>
                        <Button onClick={handleApprove} disabled={updating} className="flex-1" variant="hero">
                          <CheckCircle className="h-4 w-4 ml-1" />
                          {updating ? "جارٍ..." : "اعتماد"}
                        </Button>
                        <Button onClick={handleReject} disabled={updating} variant="destructive" className="flex-1">
                          <XCircle className="h-4 w-4 ml-1" />
                          {updating ? "جارٍ..." : "رفض"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Receipt Full Preview */}
      <Dialog open={!!receiptPreview} onOpenChange={open => { if (!open) setReceiptPreview(null); }}>
        <DialogContent className="max-w-2xl">
          {receiptPreview && (
            <img src={receiptPreview} alt="إيصال الدفع" className="w-full object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden Print Template */}
      {printInvoice && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <div ref={printRef}>
            {renderPrintInvoice(printInvoice)}
          </div>
        </div>
      )}
    </div>
  );
}
