import { supabase } from "@/integrations/supabase/client";

interface ScheduleSlot {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Validates that a proposed schedule time is not in the past and does not
 * overlap with any of the teacher's existing scheduled lessons (individual or group).
 *
 * @returns null if valid, or an error message string if invalid.
 */
export async function validateScheduleSlot(
  teacherId: string,
  proposedStart: Date,
  durationMinutes: number,
  /** ID to exclude from overlap check (e.g. booking being edited) */
  excludeBookingId?: string,
  /** Group session ID to exclude */
  excludeSessionId?: string,
): Promise<string | null> {
  // 1. Reject past dates
  if (proposedStart < new Date()) {
    return "لا يمكن حجز موعد في الماضي";
  }

  const proposedEnd = new Date(proposedStart.getTime() + durationMinutes * 60_000);

  // 2. Fetch all teacher's scheduled individual bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, scheduled_at, lessons(duration_minutes, title)")
    .eq("teacher_id", teacherId)
    .in("status", ["scheduled", "accepted"])
    .not("scheduled_at", "is", null);

  // 3. Fetch all teacher's group session schedules
  const { data: teacherLessons } = await supabase
    .from("lessons")
    .select("id, duration_minutes, title")
    .eq("teacher_id", teacherId)
    .eq("lesson_type", "group")
    .eq("is_active", true);

  let groupSessions: any[] = [];
  if (teacherLessons && teacherLessons.length > 0) {
    const lessonIds = teacherLessons.map(l => l.id);
    const { data: sessions } = await supabase
      .from("group_session_schedules")
      .select("id, lesson_id, scheduled_at, session_number, title")
      .in("lesson_id", lessonIds)
      .in("status", ["pending", "active"])
      .not("scheduled_at", "is", null);
    groupSessions = sessions ?? [];
  }

  // Build a list of existing slots
  const existingSlots: ScheduleSlot[] = [];

  for (const b of (bookings ?? [])) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    const start = new Date(b.scheduled_at!);
    const dur = (b.lessons as any)?.duration_minutes || 60;
    const end = new Date(start.getTime() + dur * 60_000);
    existingSlots.push({ start, end, label: (b.lessons as any)?.title || "حصة فردية" });
  }

  const lessonMap = new Map(teacherLessons?.map(l => [l.id, l]) ?? []);
  for (const s of groupSessions) {
    if (excludeSessionId && s.id === excludeSessionId) continue;
    const start = new Date(s.scheduled_at);
    const lesson = lessonMap.get(s.lesson_id);
    const dur = lesson?.duration_minutes || 60;
    const end = new Date(start.getTime() + dur * 60_000);
    existingSlots.push({ start, end, label: s.title || lesson?.title || "حصة جماعية" });
  }

  // 4. Check overlaps
  for (const slot of existingSlots) {
    if (proposedStart < slot.end && proposedEnd > slot.start) {
      const timeStr = slot.start.toLocaleString("ar");
      return `الموعد يتداخل مع "${slot.label}" (${timeStr})`;
    }
  }

  return null;
}
