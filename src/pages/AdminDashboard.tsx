import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, BookOpen, GraduationCap, BarChart3, Megaphone, Settings, DollarSign, Trash2, LogOut, Edit, Phone, Mail, Calendar, User, Save, Search, Wrench, ImagePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import TeachersManagement from "@/components/admin/TeachersManagement";

export default function AdminDashboard() {
  const { user, loading, isAdmin, isSupervisor, signOut } = useAuthContext();
  const [dataLoading, setDataLoading] = useState(true);
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, teachers: 0, lessons: 0, income: 0 });
  const [curricula, setCurricula] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [skillCats, setSkillCats] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentPhone, setEditStudentPhone] = useState("");
  const [editStudentBio, setEditStudentBio] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementDesc, setAnnouncementDesc] = useState("");

  // Site settings states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerDesc, setBannerDesc] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [offers, setOffers] = useState<{title: string; description: string; image_url?: string}[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || (!isAdmin && !isSupervisor)) {
      navigate("/");
      return;
    }
    setDataLoading(true);
    loadData().finally(() => setDataLoading(false));
  }, [user, loading, isAdmin, isSupervisor]);

  const loadData = async () => {
    const [curricRes, gradeRes, subjectRes, skillRes, announcRes, studentsRes, teachersRes] = await Promise.all([
      supabase.from("curricula").select("*"),
      supabase.from("grade_levels").select("*, curricula(name)"),
      supabase.from("subjects").select("*, grade_levels(name, curricula(name))"),
      supabase.from("skills_categories").select("*"),
      supabase.from("announcements").select("*").order("display_order"),
      supabase.from("user_roles").select("*").eq("role", "student"),
      supabase.from("user_roles").select("*").eq("role", "teacher"),
    ]);

    setCurricula(curricRes.data ?? []);
    setGradeLevels(gradeRes.data ?? []);
    setSubjects(subjectRes.data ?? []);
    setSkillCats(skillRes.data ?? []);
    setAnnouncements(announcRes.data ?? []);

    // Fetch profiles separately for students and teachers
    const allUserIds = [
      ...(studentsRes.data ?? []).map((s) => s.user_id),
      ...(teachersRes.data ?? []).map((t) => t.user_id),
    ];
    const uniqueIds = [...new Set(allUserIds)];
    let profilesMap: Record<string, any> = {};
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles")
        .select("user_id, full_name, phone, bio, avatar_url, created_at")
        .in("user_id", uniqueIds);
      profiles?.forEach((p) => { profilesMap[p.user_id] = p; });
    }

    const enrichedStudents = (studentsRes.data ?? []).map((s) => ({
      ...s,
      profiles: profilesMap[s.user_id] || null,
    }));
    const enrichedTeachers = (teachersRes.data ?? []).map((t) => ({
      ...t,
      profiles: profilesMap[t.user_id] || null,
    }));
    setStudents(enrichedStudents);
    setTeachers(enrichedTeachers);

    // Stats
    const { count: lessonCount } = await supabase.from("lessons").select("*", { count: "exact", head: true });
    const { data: completedBookings } = await supabase.from("bookings").select("amount").eq("status", "completed");
    const income = completedBookings?.reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

    setStats({
      students: enrichedStudents.length,
      teachers: enrichedTeachers.length,
      lessons: lessonCount ?? 0,
      income,
    });

    if (isAdmin) {
      const { data: wData } = await supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false });
      // Fetch teacher names for withdrawals
      const wTeacherIds = [...new Set((wData ?? []).map((w) => w.teacher_id))];
      let wProfilesMap: Record<string, any> = {};
      if (wTeacherIds.length > 0) {
        const { data: wProfiles } = await supabase.from("profiles")
          .select("user_id, full_name")
          .in("user_id", wTeacherIds);
        wProfiles?.forEach((p) => { wProfilesMap[p.user_id] = p; });
      }
      const enrichedWithdrawals = (wData ?? []).map((w) => ({
        ...w,
        profiles: wProfilesMap[w.teacher_id] || null,
      }));
      setWithdrawals(enrichedWithdrawals);
    }

    // Load site settings
    const { data: settingsData } = await supabase.from("site_settings").select("*");
    if (settingsData) {
      for (const s of settingsData) {
        if (s.key === "maintenance_mode") setMaintenanceMode(s.value === true);
        if (s.key === "home_banner_title") setBannerTitle(typeof s.value === "string" ? s.value : "");
        if (s.key === "home_banner_description") setBannerDesc(typeof s.value === "string" ? s.value : "");
        if (s.key === "home_banner_image") setBannerImage(typeof s.value === "string" ? s.value : "");
        if (s.key === "offers") setOffers(Array.isArray(s.value) ? s.value as any : []);
      }
    }
  };

  const addCurriculum = async () => {
    if (!newName) return;
    await supabase.from("curricula").insert({ name: newName });
    setNewName("");
    toast.success("تمت الإضافة");
    loadData();
  };

  const addGradeLevel = async () => {
    if (!newName || !selectedCurriculum) return;
    await supabase.from("grade_levels").insert({ name: newName, curriculum_id: selectedCurriculum });
    setNewName("");
    toast.success("تمت الإضافة");
    loadData();
  };

  const addSubject = async () => {
    if (!newName || !selectedGrade) return;
    await supabase.from("subjects").insert({ name: newName, grade_level_id: selectedGrade });
    setNewName("");
    toast.success("تمت الإضافة");
    loadData();
  };

  const addSkillCategory = async () => {
    if (!newName) return;
    await supabase.from("skills_categories").insert({ name: newName });
    setNewName("");
    toast.success("تمت الإضافة");
    loadData();
  };

  const addAnnouncement = async () => {
    if (!announcementTitle) return;
    await supabase.from("announcements").insert({ title: announcementTitle, description: announcementDesc });
    setAnnouncementTitle("");
    setAnnouncementDesc("");
    toast.success("تمت الإضافة");
    loadData();
  };

  const handleWithdrawalAction = async (id: string, status: string) => {
    await supabase.from("withdrawal_requests").update({ status }).eq("id", id);
    toast.success("تم التحديث");
    loadData();
  };

  const saveStudentProfile = async () => {
    if (!selectedStudent) return;
    setSavingStudent(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editStudentName,
      phone: editStudentPhone,
      bio: editStudentBio,
    }).eq("user_id", selectedStudent.user_id);
    if (error) toast.error("خطأ في حفظ البيانات");
    else {
      toast.success("تم حفظ بيانات الطالب");
      setSelectedStudent(null);
      loadData();
    }
    setSavingStudent(false);
  };

  const deleteItem = async (table: "curricula" | "grade_levels" | "subjects" | "skills_categories" | "announcements", id: string) => {
    await supabase.from(table).delete().eq("id", id);
    toast.success("تم الحذف");
    loadData();
  };

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    const path = `${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error("خطأ في رفع الصورة"); return null; }
    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
    return publicUrl;
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "banners");
    if (url) setBannerImage(url);
  };

  const handleOfferImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "offers");
    if (url) {
      const updated = [...offers];
      updated[index] = { ...updated[index], image_url: url };
      setOffers(updated);
    }
  };

  const saveSiteSettings = async () => {
    setSavingSettings(true);
    const updates = [
      supabase.from("site_settings").update({ value: maintenanceMode } as any).eq("key", "maintenance_mode"),
      supabase.from("site_settings").update({ value: bannerTitle } as any).eq("key", "home_banner_title"),
      supabase.from("site_settings").update({ value: bannerDesc } as any).eq("key", "home_banner_description"),
      supabase.from("site_settings").update({ value: bannerImage } as any).eq("key", "home_banner_image"),
      supabase.from("site_settings").update({ value: offers } as any).eq("key", "offers"),
    ];
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    if (hasError) toast.error("خطأ في حفظ الإعدادات");
    else toast.success("تم حفظ الإعدادات");
    setSavingSettings(false);
  };

  const addOffer = () => {
    setOffers([...offers, { title: "", description: "", image_url: "" }]);
  };

  const removeOffer = (index: number) => {
    setOffers(offers.filter((_, i) => i !== index));
  };

  const updateOffer = (index: number, field: "title" | "description", value: string) => {
    const updated = [...offers];
    updated[index] = { ...updated[index], [field]: value };
    setOffers(updated);
  };

  const statCards = [
    { label: "الطلاب", value: stats.students, icon: Users, color: "text-primary" },
    { label: "المعلمين", value: stats.teachers, icon: GraduationCap, color: "text-secondary" },
    { label: "الحصص", value: stats.lessons, icon: BookOpen, color: "text-accent" },
    { label: "الدخل", value: `${stats.income} ر.س`, icon: DollarSign, color: "text-success" },
  ];

  if (dataLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <h1 className="text-lg font-bold text-primary">
            {isAdmin ? "لوحة الإدارة" : "لوحة المشرف"}
          </h1>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container py-6">
        {/* Stats */}
        {isAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {statCards.map((s) => (
              <div key={s.label} className="bg-card rounded-xl p-4 border border-border text-center">
                <s.icon className={`h-6 w-6 mx-auto mb-1 ${s.color}`} />
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="curricula">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="students">الطلاب</TabsTrigger>
            <TabsTrigger value="teachers">المعلمين</TabsTrigger>
            <TabsTrigger value="curricula">المناهج</TabsTrigger>
            <TabsTrigger value="grades">الصفوف</TabsTrigger>
            <TabsTrigger value="subjects">المواد</TabsTrigger>
            <TabsTrigger value="announcements">الإعلانات</TabsTrigger>
            {isAdmin && <TabsTrigger value="skills">مهارات</TabsTrigger>}
            {isAdmin && <TabsTrigger value="withdrawals">طلبات السحب</TabsTrigger>}
            {isAdmin && <TabsTrigger value="site-settings">إعدادات الموقع</TabsTrigger>}
          </TabsList>

          <TabsContent value="students" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو الهاتف..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pr-10" />
            </div>
            <p className="text-xs text-muted-foreground">{students.filter(s => {
              const name = s.profiles?.full_name || "";
              const phone = s.profiles?.phone || "";
              return name.includes(studentSearch) || phone.includes(studentSearch);
            }).length} طالب</p>
            <div className="space-y-2">
              {students.filter(s => {
                const name = s.profiles?.full_name || "";
                const phone = s.profiles?.phone || "";
                return name.includes(studentSearch) || phone.includes(studentSearch);
              }).map((s) => (
                <div
                  key={s.id}
                  className="bg-card rounded-xl p-3 border border-border cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => {
                    setSelectedStudent(s);
                    setEditStudentName(s.profiles?.full_name || "");
                    setEditStudentPhone(s.profiles?.phone || "");
                    setEditStudentBio(s.profiles?.bio || "");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.profiles?.full_name ?? "بدون اسم"}</p>
                      <p className="text-xs text-muted-foreground">{s.profiles?.phone || "بدون هاتف"}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.profiles?.created_at && new Date(s.profiles.created_at).toLocaleDateString("ar")}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Student detail dialog */}
            <Dialog open={!!selectedStudent} onOpenChange={open => { if (!open) setSelectedStudent(null); }}>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                {selectedStudent && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        تفاصيل الطالب
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label className="text-xs mb-1 block">الاسم</Label>
                        <Input value={editStudentName} onChange={e => setEditStudentName(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">الهاتف</Label>
                        <Input value={editStudentPhone} onChange={e => setEditStudentPhone(e.target.value)} dir="ltr" />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">نبذة</Label>
                        <Textarea value={editStudentBio} onChange={e => setEditStudentBio(e.target.value)} rows={3} placeholder="نبذة عن الطالب..." />
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        تاريخ التسجيل: {selectedStudent.profiles?.created_at ? new Date(selectedStudent.profiles.created_at).toLocaleDateString("ar") : "غير معروف"}
                      </div>
                      <Button onClick={saveStudentProfile} variant="hero" className="w-full" disabled={savingStudent}>
                        <Save className="h-4 w-4 ml-1" />
                        {savingStudent ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="teachers" className="mt-4">
            <TeachersManagement />
          </TabsContent>

          <TabsContent value="curricula" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input placeholder="اسم المنهج" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={addCurriculum} variant="hero"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              {curricula.map((c) => (
                <div key={c.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem("curricula", c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="grades" className="mt-4 space-y-4">
            <div className="space-y-2">
              <select className="w-full rounded-lg border border-border p-2 bg-background text-sm"
                value={selectedCurriculum} onChange={(e) => setSelectedCurriculum(e.target.value)}>
                <option value="">اختر المنهج</option>
                {curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <Input placeholder="اسم الصف" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button onClick={addGradeLevel} variant="hero"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              {gradeLevels.map((g) => (
                <div key={g.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
                  <div>
                    <span className="font-medium text-sm">{g.name}</span>
                    <span className="text-xs text-muted-foreground mr-2">({(g as any).curricula?.name})</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem("grade_levels", g.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="subjects" className="mt-4 space-y-4">
            <div className="space-y-2">
              <select className="w-full rounded-lg border border-border p-2 bg-background text-sm"
                value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option value="">اختر الصف</option>
                {gradeLevels.map((g) => <option key={g.id} value={g.id}>{g.name} - {(g as any).curricula?.name ?? ""}</option>)}
              </select>
              <div className="flex gap-2">
                <Input placeholder="اسم المادة" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button onClick={addSubject} variant="hero"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              {subjects.map((s) => (
                <div key={s.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
                  <div>
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className="text-xs text-muted-foreground mr-2">({(s as any).grade_levels?.name}) منهج {(s as any).grade_levels?.curricula?.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem("subjects", s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="announcements" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Input placeholder="عنوان الإعلان" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
              <Input placeholder="وصف الإعلان" value={announcementDesc} onChange={(e) => setAnnouncementDesc(e.target.value)} />
              <Button onClick={addAnnouncement} variant="hero" className="w-full">إضافة إعلان</Button>
            </div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem("announcements", a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="skills" className="mt-4 space-y-4">
              <div className="flex gap-2">
                <Input placeholder="نوع الموهبة" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button onClick={addSkillCategory} variant="hero"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                {skillCats.map((s) => (
                  <div key={s.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
                    <span className="font-medium text-sm">{s.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem("skills_categories", s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="withdrawals" className="mt-4 space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="bg-card rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium text-sm">{(w as any).profiles?.full_name}</p>
                      <p className="text-lg font-bold">{w.amount} ر.س</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      w.status === "approved" ? "bg-success/10 text-success" :
                      w.status === "rejected" ? "bg-destructive/10 text-destructive" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {w.status === "pending" ? "قيد المراجعة" : w.status === "approved" ? "مقبول" : "مرفوض"}
                    </span>
                  </div>
                    {w.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="hero" className="flex-1" onClick={() => handleWithdrawalAction(w.id, "approved")}>قبول</Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleWithdrawalAction(w.id, "rejected")}>رفض</Button>
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="site-settings" className="mt-4 space-y-6">
              {/* Maintenance Mode */}
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">إغلاق الموقع مؤقتاً</h3>
                    <p className="text-xs text-muted-foreground">عند التفعيل ستظهر صفحة "تحت الصيانة" للزوار</p>
                  </div>
                  <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                </div>
                {maintenanceMode && (
                  <div className="bg-destructive/10 rounded-lg p-3 text-destructive text-xs flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    الموقع مغلق حالياً - الزوار يرون صفحة الصيانة
                  </div>
                )}
              </div>

              {/* Banner Settings */}
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <h3 className="font-semibold text-sm">بانر الصفحة الرئيسية</h3>
                <div>
                  <Label className="text-xs">عنوان البانر</Label>
                  <Input value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">وصف البانر</Label>
                  <Input value={bannerDesc} onChange={e => setBannerDesc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">صورة البانر</Label>
                  <p className="text-[10px] text-muted-foreground mb-1">الحجم المقترح: 1200×400 بكسل (نسبة 3:1) — بصيغة JPG أو PNG — أقصى حجم 2 ميجابايت</p>
                  <div className="flex items-center gap-3 mt-1">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors">
                      <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">اختر صورة</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} />
                    </label>
                    {bannerImage && (
                      <div className="relative">
                        <img src={bannerImage} alt="بانر" className="h-16 w-28 object-cover rounded-lg" />
                        <button onClick={() => setBannerImage("")} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]">×</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Offers Settings */}
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">العروض والخصومات</h3>
                  <Button size="sm" variant="outline" onClick={addOffer}><Plus className="h-4 w-4 ml-1" />إضافة عرض</Button>
                </div>
                {offers.map((offer, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">عرض {i + 1}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeOffer(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Input placeholder="عنوان العرض" value={offer.title} onChange={e => updateOffer(i, "title", e.target.value)} />
                    <Input placeholder="وصف العرض" value={offer.description} onChange={e => updateOffer(i, "description", e.target.value)} />
                    <p className="text-[10px] text-muted-foreground">الحجم المقترح: 600×300 بكسل (نسبة 2:1) — JPG أو PNG — أقصى 1 ميجابايت</p>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors">
                        <ImagePlus className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">صورة</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleOfferImageUpload(i, e)} />
                      </label>
                      {offer.image_url && (
                        <div className="relative">
                          <img src={offer.image_url} alt="" className="h-10 w-16 object-cover rounded" />
                          <button onClick={() => { const u = [...offers]; u[i] = { ...u[i], image_url: "" }; setOffers(u); }} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-3.5 w-3.5 flex items-center justify-center text-[8px]">×</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={saveSiteSettings} variant="hero" className="w-full" disabled={savingSettings}>
                <Save className="h-4 w-4 ml-1" />
                {savingSettings ? "جارٍ الحفظ..." : "حفظ جميع الإعدادات"}
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
