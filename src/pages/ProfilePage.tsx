import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, GraduationCap, HelpCircle, MessageCircle } from "lucide-react";

const faqs = [
  { q: "كيف أحجز حصة؟", a: "اختر نوع الدرس، ثم اختر المعلم المناسب، وقم بشراء الحصة." },
  { q: "كيف أدفع؟", a: "يمكنك الدفع عبر PayPal أو التحويل البنكي مع إرفاق الإيصال." },
  { q: "متى تبدأ الحصة؟", a: "بعد الشراء، سيقوم المعلم بتحديد الموعد المناسب." },
  { q: "كيف أدخل الحصة؟", a: "من خلال جدولك، اضغط على زر الدخول للحصة عبر زوم." },
];

export default function ProfilePage() {
  const { user, isStudent, signOut } = useAuthContext();
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [curricula, setCurricula] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [contactInfo, setContactInfo] = useState<{ email: string; phone: string; whatsapp: string }>({ email: "", phone: "", whatsapp: "" });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setShowPasswordForm(true);
    });
    return () => subscription.unsubscribe();
  }, []);

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
    supabase.from("site_settings").select("value").eq("key", "contact_info").single()
      .then(({ data }) => {
        if (data && typeof data.value === "object" && data.value !== null) {
          const v = data.value as any;
          setContactInfo({ email: v.email || "", phone: v.phone || "", whatsapp: v.whatsapp || "" });
        }
      });
  }, []);

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

  if (!user) return null;

  const defaultTab = isStudent ? "personal" : "personal";

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">الملف الشخصي</h1>

        {showPasswordForm && (
          <div className="bg-card rounded-xl p-4 border border-primary space-y-4 mb-4">
            <h2 className="font-bold">تعيين كلمة مرور جديدة</h2>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="أدخل كلمة المرور الجديدة" dir="ltr" />
            </div>
            <Button variant="hero" className="w-full" disabled={newPassword.length < 6} onClick={async () => {
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) toast.error("حدث خطأ أثناء تحديث كلمة المرور");
              else { toast.success("تم تغيير كلمة المرور بنجاح"); setShowPasswordForm(false); setNewPassword(""); }
            }}>
              حفظ كلمة المرور
            </Button>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full" dir="rtl">
          <TabsList className="w-full flex flex-col h-auto gap-1 mb-4 p-2">
            <TabsTrigger value="personal" className="w-full justify-start gap-2 px-3 py-2.5">
              <User className="h-4 w-4" />
              <span>معلومات شخصية</span>
            </TabsTrigger>
            {isStudent && (
              <TabsTrigger value="study" className="w-full justify-start gap-2 px-3 py-2.5">
                <GraduationCap className="h-4 w-4" />
                <span>المعلومات الدراسية</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="faq" className="w-full justify-start gap-2 px-3 py-2.5">
              <HelpCircle className="h-4 w-4" />
              <span>الأسئلة الشائعة</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="w-full justify-start gap-2 px-3 py-2.5">
              <MessageCircle className="h-4 w-4" />
              <span>تواصل معنا</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal">
            <div className="bg-card rounded-xl p-4 border border-border space-y-4">
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
              <Button type="button" variant="outline" className="w-full" onClick={async () => {
                if (!user?.email) return;
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + "/profile" });
                if (error) toast.error("حدث خطأ أثناء الإرسال");
                else toast.success("تم إرسال رابط تغيير كلمة المرور إلى بريدك الإلكتروني");
              }}>
                تغيير كلمة المرور
              </Button>
            </div>
          </TabsContent>

          {/* Study Info Tab - Students Only */}
          {isStudent && (
            <TabsContent value="study">
              <div className="bg-card rounded-xl p-4 border border-border space-y-4">
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
                <Button onClick={handleSave} disabled={saving} variant="hero" className="w-full">
                  {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </Button>
              </div>
            </TabsContent>
          )}

          {/* FAQ Tab */}
          <TabsContent value="faq">
            <div className="bg-card rounded-xl p-4 border border-border">
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
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact">
            <div className="bg-card rounded-xl p-4 border border-border space-y-4">
              <h2 className="font-bold">تواصل معنا</h2>
              <p className="text-sm text-muted-foreground">يمكنك التواصل معنا عبر الوسائل التالية:</p>
              <div className="space-y-3">
                {contactInfo.email && (
                  <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <span className="text-xl">📧</span>
                    <div>
                      <p className="font-medium text-sm">البريد الإلكتروني</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{contactInfo.email}</p>
                    </div>
                  </a>
                )}
                {contactInfo.phone && (
                  <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="font-medium text-sm">الهاتف</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{contactInfo.phone}</p>
                    </div>
                  </a>
                )}
                {contactInfo.whatsapp && (
                  <a href={`https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <span className="text-xl">💬</span>
                    <div>
                      <p className="font-medium text-sm">واتساب</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{contactInfo.whatsapp}</p>
                    </div>
                  </a>
                )}
                {!contactInfo.email && !contactInfo.phone && !contactInfo.whatsapp && (
                  <p className="text-sm text-muted-foreground text-center py-4">لم يتم إضافة بيانات التواصل بعد</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <button
          type="button"
          onClick={() => {
            supabase.auth.signOut({ scope: 'local' }).then(() => {
              window.location.href = "/";
            }).catch(() => {
              window.location.href = "/";
            });
          }}
          className="w-full mt-6 bg-destructive text-destructive-foreground rounded-lg py-3 font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </AppLayout>
  );
}
