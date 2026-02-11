import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, UserMinus, Save, Search, Edit, BookOpen, Star, Calendar, Phone, User, Mail, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfile {
  user_id: string;
  full_name: string;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  email?: string;
  isTeacher: boolean;
  roleId?: string;
  admin_notes?: string;
  lessonCount: number;
  bookingCount: number;
  avgRating: number;
  totalIncome: number;
  roles: string[];
}

export default function TeachersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notesValue, setNotesValue] = useState("");
  const [filter, setFilter] = useState<"all" | "teachers" | "non-teachers">("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, lessonsRes, bookingsRes, reviewsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, bio, avatar_url, created_at"),
        supabase.from("user_roles").select("id, user_id, role, admin_notes"),
        supabase.from("lessons").select("id, teacher_id"),
        supabase.from("bookings").select("teacher_id, amount, status"),
        supabase.from("reviews").select("teacher_id, rating"),
      ]);

      const profiles = profilesRes.data ?? [];
      const roles = rolesRes.data ?? [];

      // Build maps
      const rolesMap = new Map<string, { roles: string[]; teacherRoleId?: string; admin_notes?: string }>();
      for (const r of roles) {
        const existing = rolesMap.get(r.user_id) ?? { roles: [] };
        existing.roles.push(r.role);
        if (r.role === "teacher") {
          existing.teacherRoleId = r.id;
          existing.admin_notes = r.admin_notes ?? "";
        }
        rolesMap.set(r.user_id, existing);
      }

      const lessonCountMap = new Map<string, number>();
      for (const l of lessonsRes.data ?? []) {
        lessonCountMap.set(l.teacher_id, (lessonCountMap.get(l.teacher_id) ?? 0) + 1);
      }

      const bookingMap = new Map<string, { count: number; income: number }>();
      for (const b of bookingsRes.data ?? []) {
        const existing = bookingMap.get(b.teacher_id) ?? { count: 0, income: 0 };
        existing.count++;
        if (b.status === "completed") existing.income += Number(b.amount);
        bookingMap.set(b.teacher_id, existing);
      }

      const ratingMap = new Map<string, { sum: number; count: number }>();
      for (const r of reviewsRes.data ?? []) {
        const existing = ratingMap.get(r.teacher_id) ?? { sum: 0, count: 0 };
        existing.sum += r.rating;
        existing.count++;
        ratingMap.set(r.teacher_id, existing);
      }

      const mapped: UserProfile[] = profiles.map(p => {
        const roleData = rolesMap.get(p.user_id);
        const bData = bookingMap.get(p.user_id);
        const rData = ratingMap.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name || "بدون اسم",
          phone: p.phone,
          bio: p.bio,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          isTeacher: roleData?.roles.includes("teacher") ?? false,
          roleId: roleData?.teacherRoleId,
          admin_notes: roleData?.admin_notes ?? "",
          roles: roleData?.roles ?? [],
          lessonCount: lessonCountMap.get(p.user_id) ?? 0,
          bookingCount: bData?.count ?? 0,
          avgRating: rData ? Math.round((rData.sum / rData.count) * 10) / 10 : 0,
          totalIncome: bData?.income ?? 0,
        };
      });

      setUsers(mapped);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeacher = async (user: UserProfile) => {
    if (user.isTeacher && user.roleId) {
      await supabase.from("user_roles").delete().eq("id", user.roleId);
      toast.success("تم إزالة صلاحية المعلم");
    } else {
      await supabase.from("user_roles").insert({ user_id: user.user_id, role: "teacher" as any });
      toast.success("تم تعيين المستخدم كمعلم");
    }
    setSelectedUser(null);
    loadUsers();
  };

  const saveNotes = async (user: UserProfile) => {
    if (!user.roleId) return;
    await supabase.from("user_roles").update({ admin_notes: notesValue } as any).eq("id", user.roleId);
    toast.success("تم حفظ الملاحظات");
    loadUsers();
  };

  const filtered = users
    .filter(u => {
      if (filter === "teachers") return u.isTeacher;
      if (filter === "non-teachers") return !u.isTeacher;
      return true;
    })
    .filter(u =>
      u.full_name.includes(search) || u.phone?.includes(search) || u.user_id.includes(search)
    );

  const teacherCount = users.filter(u => u.isTeacher).length;

  if (loading) return <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-primary">{users.length}</p>
          <p className="text-[10px] text-muted-foreground">إجمالي المستخدمين</p>
        </div>
        <div className="bg-secondary/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-secondary">{teacherCount}</p>
          <p className="text-[10px] text-muted-foreground">المعلمين</p>
        </div>
        <div className="bg-accent/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-accent">{users.length - teacherCount}</p>
          <p className="text-[10px] text-muted-foreground">غير معلمين</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
        </div>
        <select
          className="rounded-lg border border-border px-2 bg-background text-xs"
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
        >
          <option value="all">الكل</option>
          <option value="teachers">معلمين فقط</option>
          <option value="non-teachers">غير معلمين</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} نتيجة</p>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map(u => (
          <div
            key={u.user_id}
            className="bg-card rounded-xl p-3 border border-border cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => { setSelectedUser(u); setNotesValue(u.admin_notes ?? ""); }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{u.full_name}</p>
                  {u.isTeacher && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">معلم</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{u.phone ?? "بدون رقم"}</p>
              </div>
              {u.isTeacher && (
                <div className="flex gap-3 text-[10px] text-muted-foreground shrink-0">
                  <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" />{u.lessonCount}</span>
                  <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-yellow-500" />{u.avgRating || "-"}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد نتائج</p>}
      </div>

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {selectedUser.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p>{selectedUser.full_name}</p>
                    <div className="flex gap-1 mt-1">
                      {selectedUser.roles.map(r => (
                        <Badge key={r} variant="outline" className="text-[10px]">{r === "admin" ? "أدمن" : r === "teacher" ? "معلم" : r === "supervisor" ? "مشرف" : "طالب"}</Badge>
                      ))}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Info section */}
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{selectedUser.phone ?? "غير متوفر"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(selectedUser.created_at).toLocaleDateString("ar")}</span>
                  </div>
                </div>

                {selectedUser.bio && (
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground mb-1">النبذة التعريفية</p>
                    <p className="text-sm">{selectedUser.bio}</p>
                  </div>
                )}

                {/* Teacher stats */}
                {selectedUser.isTeacher && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-primary/5 rounded-lg p-3 text-center">
                      <BookOpen className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <p className="text-base font-bold">{selectedUser.lessonCount}</p>
                      <p className="text-[10px] text-muted-foreground">حصة</p>
                    </div>
                    <div className="bg-secondary/5 rounded-lg p-3 text-center">
                      <Calendar className="h-4 w-4 mx-auto mb-1 text-secondary" />
                      <p className="text-base font-bold">{selectedUser.bookingCount}</p>
                      <p className="text-[10px] text-muted-foreground">حجز</p>
                    </div>
                    <div className="bg-yellow-500/5 rounded-lg p-3 text-center">
                      <Star className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                      <p className="text-base font-bold">{selectedUser.avgRating || "-"}</p>
                      <p className="text-[10px] text-muted-foreground">التقييم</p>
                    </div>
                    <div className="bg-green-500/5 rounded-lg p-3 text-center">
                      <FileText className="h-4 w-4 mx-auto mb-1 text-green-600" />
                      <p className="text-base font-bold">{selectedUser.totalIncome} ر.س</p>
                      <p className="text-[10px] text-muted-foreground">الدخل</p>
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                {selectedUser.isTeacher && (
                  <div>
                    <Label className="text-xs mb-1 block">ملاحظات الأدمن</Label>
                    <Textarea
                      value={notesValue}
                      onChange={e => setNotesValue(e.target.value)}
                      placeholder="أضف ملاحظات خاصة بهذا المعلم..."
                      rows={3}
                    />
                    <Button onClick={() => saveNotes(selectedUser)} variant="outline" size="sm" className="mt-2 w-full">
                      <Save className="h-3 w-3 ml-1" />
                      حفظ الملاحظات
                    </Button>
                  </div>
                )}

                {/* Action */}
                <Button
                  variant={selectedUser.isTeacher ? "destructive" : "hero"}
                  className="w-full"
                  onClick={() => toggleTeacher(selectedUser)}
                >
                  {selectedUser.isTeacher ? (
                    <><UserMinus className="h-4 w-4 ml-1" />إزالة صلاحية المعلم</>
                  ) : (
                    <><UserPlus className="h-4 w-4 ml-1" />تعيين كمعلم</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
