import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut } from "lucide-react";

const faqs = [
  { q: "كيف أحجز حصة؟", a: "اختر نوع الدرس، ثم اختر المعلم المناسب، وقم بشراء الحصة." },
  { q: "كيف أدفع؟", a: "يمكنك الدفع عبر PayPal أو التحويل البنكي مع إرفاق الإيصال." },
  { q: "متى تبدأ الحصة؟", a: "بعد الشراء، سيقوم المعلم بتحديد الموعد المناسب." },
  { q: "كيف أدخل الحصة؟", a: "من خلال جدولك، اضغط على زر الدخول للحصة عبر زوم." },
];

export default function ProfilePage() {
  const { user, isStudent, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [curricula, setCurricula] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => {
        setProfile(data);
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setSelectedCurriculum((data as any)?.curriculum_id ?? "");
        setSelectedGrade((data as any)?.grade_level_id ?? "");
      });
  }, [user]);

  useEffect(() => {
    if (isStudent) {
      supabase.from("curricula").select("*").then(({ data }) => setCurricula(data ?? []));
    }
  }, [isStudent]);

  useEffect(() => {
    if (selectedCurriculum) {
      supabase.from("grade_levels").select("*").eq("curriculum_id", selectedCurriculum)
        .then(({ data }) => setGradeLevels(data ?? []));
    } else {
      setGradeLevels([]);
    }
  }, [selectedCurriculum]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const updateData: any = { full_name: fullName, phone };
    if (isStudent) {
      updateData.curriculum_id = selectedCurriculum || null;
      updateData.grade_level_id = selectedGrade || null;
    }
    const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user.id);
    if (error) toast.error("حدث خطأ"); else toast.success("تم الحفظ");
    setSaving(false);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // ignore
    }
    window.location.href = "/";
  };

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">الملف الشخصي</h1>

        <div className="bg-card rounded-xl p-4 border border-border space-y-4 mb-6">
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input value={user.email ?? ""} disabled dir="ltr" />
          </div>
          <Button onClick={handleSave} disabled={saving} variant="hero" className="w-full">
            {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </Button>
        </div>

        {isStudent && (
          <div className="bg-card rounded-xl p-4 border border-border space-y-4 mb-6">
            <h2 className="font-bold">المعلومات الدراسية</h2>
            <div className="space-y-2">
              <Label>المنهج الدراسي</Label>
              <Select value={selectedCurriculum} onValueChange={(v) => { setSelectedCurriculum(v); setSelectedGrade(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر المنهج" /></SelectTrigger>
                <SelectContent>
                  {curricula.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المرحلة الدراسية</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade} disabled={!selectedCurriculum}>
                <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                <SelectContent>
                  {gradeLevels.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">سيتم استخدام هذه المعلومات لتجهيز فلاتر البحث تلقائياً عند تصفح الدروس</p>
          </div>
        )}

        <div className="bg-card rounded-xl p-4 border border-border mb-6">
          <h2 className="font-bold mb-3">الأسئلة الشائعة</h2>
          <Accordion type="single" collapsible>
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-right">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <button
          type="button"
          onClick={() => {
            console.log("LOGOUT CLICKED");
            supabase.auth.signOut({ scope: 'local' }).then(() => {
              window.location.href = "/";
            }).catch(() => {
              window.location.href = "/";
            });
          }}
          className="w-full bg-destructive text-destructive-foreground rounded-lg py-3 font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </AppLayout>
  );
}
