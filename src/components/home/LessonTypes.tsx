import { Link } from "react-router-dom";
import { BookOpen, Backpack, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const types = [
  {
    id: "tutoring",
    title: "تقوية ومراجعة",
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
    id: "skills",
    title: "مهارات ومواهب",
    description: "تنمية المواهب والمهارات الإبداعية",
    icon: Sparkles,
    path: "/lessons/skills",
    gradient: "gradient-hero",
  },
];

export function LessonTypes() {
  return (
    <section className="px-4 mt-8">
      <h2 className="text-lg font-bold mb-4">أنواع الدروس</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {types.map((type, i) => (
          <motion.div
            key={type.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link
              to={type.path}
              className={`block ${type.gradient} rounded-xl p-6 text-foreground hover:scale-[1.02] transition-transform shadow-elevated`}
            >
              <type.icon className="h-8 w-8 mb-3" />
              <h3 className="font-bold text-lg">{type.title}</h3>
              <p className="text-sm text-foreground/70 mt-1">{type.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
