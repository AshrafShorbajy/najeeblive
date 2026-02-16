import { useNavigate } from "react-router-dom";
import { BookOpen, Backpack, Sparkles, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const allTypes = [
  {
    id: "tutoring",
    title: "دروس فردية",
    description: "دروس خصوصية في جميع المواد الدراسية",
    icon: BookOpen,
    path: "/lessons/tutoring",
    gradient: "gradient-primary",
  },
  {
    id: "bag_review",
    title: "مراجعة الشنطة",
    description: "مراجعة شاملة للصفوف الأولية",
    icon: Backpack,
    path: "/lessons/bag-review",
    gradient: "gradient-secondary",
  },
  {
    id: "group",
    title: "دروس جماعية",
    description: "كورسات جماعية مع مجموعة طلاب",
    icon: Users,
    path: "/lessons/group",
    gradient: "gradient-primary",
  },
  {
    id: "skills",
    title: "مهارات ومواهب",
    description: "تنمية المواهب والمهارات الإبداعية",
    icon: Sparkles,
    path: "/lessons/skills",
    gradient: "gradient-hero",
  },
];

export function LessonTypes() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({ tutoring: true, bag_review: true, group: true, skills: true });

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "lesson_types_visibility").maybeSingle().then(({ data }) => {
      if (data && typeof data.value === "object" && data.value !== null) {
        setVisibility(prev => ({ ...prev, ...(data.value as any) }));
      }
    });
  }, []);

  const handleClick = (path: string) => {
    if (!user) {
      toast.info("يجب تسجيل الدخول أولاً للوصول إلى الدروس");
      navigate("/auth");
      return;
    }
    navigate(path);
  };

  const visibleTypes = allTypes.filter(t => visibility[t.id] !== false);

  if (visibleTypes.length === 0) return null;

  return (
    <section className="px-4 mt-8">
      <h2 className="text-lg font-bold mb-4">أنواع الدروس</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {visibleTypes.map((type, i) => (
          <motion.div
            key={type.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <button
              onClick={() => handleClick(type.path)}
              className={`block w-full text-right ${type.gradient} rounded-xl p-6 text-foreground hover:scale-[1.02] transition-transform shadow-elevated`}
            >
              <type.icon className="h-8 w-8 mb-3" />
              <h3 className="font-bold text-lg">{type.title}</h3>
              <p className="text-sm text-foreground/70 mt-1">{type.description}</p>
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
