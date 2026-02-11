import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Heart } from "lucide-react";
import { motion } from "framer-motion";

interface TeacherResult {
  id: string;
  title: string;
  teacher_id: string;
  duration_minutes: number;
  price: number;
  teacher_name: string;
  avg_rating: number;
}

export default function TutoringPage() {
  const { type } = useParams<{ type: string }>();
  const [curricula, setCurricula] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [skillCategories, setSkillCategories] = useState<any[]>([]);

  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [studentAge, setStudentAge] = useState("");
  const [results, setResults] = useState<TeacherResult[]>([]);

  const isTutoring = type === "tutoring";
  const isBagReview = type === "bag-review";
  const isSkills = type === "skills";

  const pageTitle = isTutoring ? "تقوية ومراجعة" : isBagReview ? "مراجعة الشنطة" : "مهارات ومواهب";

  const lessonType = isTutoring ? "tutoring" : isBagReview ? "bag_review" : "skills";

  useEffect(() => {
    if (isSkills) {
      supabase.from("skills_categories").select("*").then(({ data }) => setSkillCategories(data ?? []));
    } else {
      supabase.from("curricula").select("*").then(({ data }) => setCurricula(data ?? []));
    }
  }, [isSkills]);

  useEffect(() => {
    if (selectedCurriculum) {
      supabase.from("grade_levels").select("*").eq("curriculum_id", selectedCurriculum)
        .then(({ data }) => setGradeLevels(data ?? []));
    }
  }, [selectedCurriculum]);

  useEffect(() => {
    if (selectedGrade && isTutoring) {
      supabase.from("subjects").select("*").eq("grade_level_id", selectedGrade)
        .then(({ data }) => setSubjects(data ?? []));
    }
  }, [selectedGrade, isTutoring]);

  useEffect(() => {
    const fetchResults = async () => {
      let query = supabase
        .from("lessons")
        .select("id, title, teacher_id, duration_minutes, price")
        .eq("lesson_type", lessonType)
        .eq("is_active", true);

      if (isTutoring) {
        if (selectedCurriculum) query = query.eq("curriculum_id", selectedCurriculum);
        if (selectedGrade) query = query.eq("grade_level_id", selectedGrade);
        if (selectedSubject) query = query.eq("subject_id", selectedSubject);
      } else if (isBagReview) {
        if (selectedCurriculum) query = query.eq("curriculum_id", selectedCurriculum);
        if (selectedGrade) query = query.eq("grade_level_id", selectedGrade);
      } else if (isSkills) {
        if (selectedSkill) query = query.eq("skill_category_id", selectedSkill);
      }

      const { data: lessons } = await query;
      if (!lessons || lessons.length === 0) {
        setResults([]);
        return;
      }

      const teacherIds = [...new Set(lessons.map((l) => l.teacher_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", teacherIds);

      const { data: reviews } = await supabase
        .from("reviews")
        .select("teacher_id, rating");

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]));
      const ratingMap = new Map<string, number[]>();
      reviews?.forEach((r) => {
        const arr = ratingMap.get(r.teacher_id) ?? [];
        arr.push(r.rating);
        ratingMap.set(r.teacher_id, arr);
      });

      setResults(
        lessons.map((l) => ({
          ...l,
          teacher_name: profileMap.get(l.teacher_id) ?? "معلم",
          avg_rating: ratingMap.has(l.teacher_id)
            ? ratingMap.get(l.teacher_id)!.reduce((a, b) => a + b, 0) / ratingMap.get(l.teacher_id)!.length
            : 0,
        }))
      );
    };

    const hasFilter = isSkills
      ? selectedSkill
      : isBagReview
      ? selectedCurriculum && selectedGrade
      : selectedCurriculum && selectedGrade && selectedSubject;

    if (hasFilter) fetchResults();
  }, [selectedCurriculum, selectedGrade, selectedSubject, selectedSkill, lessonType]);

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">{pageTitle}</h1>

        <div className="bg-card rounded-xl p-4 border border-border space-y-3 mb-6">
          {isSkills ? (
            <>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger><SelectValue placeholder="نوع الموهبة" /></SelectTrigger>
                <SelectContent>
                  {skillCategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={studentAge} onValueChange={setStudentAge}>
                <SelectTrigger><SelectValue placeholder="عمر الطالب" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 14 }, (_, i) => i + 5).map((age) => (
                    <SelectItem key={age} value={String(age)}>{age} سنوات</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <Select value={selectedCurriculum} onValueChange={(v) => { setSelectedCurriculum(v); setSelectedGrade(""); setSelectedSubject(""); }}>
                <SelectTrigger><SelectValue placeholder="المنهج" /></SelectTrigger>
                <SelectContent>
                  {curricula.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedGrade} onValueChange={(v) => { setSelectedGrade(v); setSelectedSubject(""); }}>
                <SelectTrigger><SelectValue placeholder="المرحلة الدراسية" /></SelectTrigger>
                <SelectContent>
                  {gradeLevels.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isTutoring && (
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger><SelectValue placeholder="المادة" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>

        <div className="space-y-3">
          {results.length === 0 && (
            <p className="text-center text-muted-foreground py-8">اختر الفلتر لعرض النتائج</p>
          )}
          {results.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/lesson/${r.id}`}
                className="block bg-card rounded-xl p-4 border border-border hover:shadow-elevated transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{r.title}</h3>
                    <p className="text-sm text-muted-foreground">{r.teacher_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-warning">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-medium">{r.avg_rating > 0 ? r.avg_rating.toFixed(1) : "جديد"}</span>
                    </div>
                    <Heart className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-destructive" />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{r.duration_minutes} دقيقة</span>
                  <span>{r.price} ر.س</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
