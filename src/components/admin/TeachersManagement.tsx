import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus, UserMinus, Save, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface UserProfile {
  user_id: string;
  full_name: string;
  phone: string | null;
  isTeacher: boolean;
  roleId?: string;
  admin_notes?: string;
}

export default function TeachersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    // Get all profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone");
    // Get all teacher roles
    const { data: teacherRoles } = await supabase.from("user_roles").select("id, user_id, admin_notes").eq("role", "teacher");

    const teacherMap = new Map(teacherRoles?.map(r => [r.user_id, { roleId: r.id, admin_notes: r.admin_notes }]) ?? []);

    const mapped: UserProfile[] = (profiles ?? []).map(p => ({
      user_id: p.user_id,
      full_name: p.full_name || "بدون اسم",
      phone: p.phone,
      isTeacher: teacherMap.has(p.user_id),
      roleId: teacherMap.get(p.user_id)?.roleId,
      admin_notes: teacherMap.get(p.user_id)?.admin_notes ?? "",
    }));

    setUsers(mapped);
    setLoading(false);
  };

  const toggleTeacher = async (user: UserProfile) => {
    if (user.isTeacher && user.roleId) {
      await supabase.from("user_roles").delete().eq("id", user.roleId);
      toast.success("تم إزالة صلاحية المعلم");
    } else {
      await supabase.from("user_roles").insert({ user_id: user.user_id, role: "teacher" as any });
      toast.success("تم تعيين المستخدم كمعلم");
    }
    loadUsers();
  };

  const saveNotes = async (user: UserProfile) => {
    if (!user.roleId) return;
    await supabase.from("user_roles").update({ admin_notes: notesValue } as any).eq("id", user.roleId);
    toast.success("تم حفظ الملاحظات");
    setEditingNotes(null);
    loadUsers();
  };

  const filtered = users.filter(u =>
    u.full_name.includes(search) || u.phone?.includes(search) || u.user_id.includes(search)
  );

  if (loading) return <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الهاتف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.user_id} className="bg-card rounded-lg p-3 border border-border">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{u.phone ?? "بدون رقم"}</p>
              </div>
              <div className="flex gap-2 items-center">
                {u.isTeacher && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingNotes(u.user_id); setNotesValue(u.admin_notes ?? ""); }}
                      >
                        <Save className="h-3 w-3 ml-1" />
                        ملاحظات
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>ملاحظات الأدمن - {u.full_name}</DialogTitle>
                      </DialogHeader>
                      <Textarea
                        value={notesValue}
                        onChange={e => setNotesValue(e.target.value)}
                        placeholder="أضف ملاحظات خاصة بهذا المعلم..."
                        rows={4}
                      />
                      <Button onClick={() => saveNotes(u)} variant="hero">حفظ</Button>
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                  variant={u.isTeacher ? "destructive" : "hero"}
                  size="sm"
                  onClick={() => toggleTeacher(u)}
                >
                  {u.isTeacher ? <><UserMinus className="h-3 w-3 ml-1" />إزالة</> : <><UserPlus className="h-3 w-3 ml-1" />تعيين معلم</>}
                </Button>
              </div>
            </div>
            {u.isTeacher && u.admin_notes && (
              <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2">{u.admin_notes}</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">لا توجد نتائج</p>}
      </div>
    </div>
  );
}
