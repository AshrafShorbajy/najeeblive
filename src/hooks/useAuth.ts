import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoles = async (userId: string): Promise<string[]> => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (error) {
          console.error("Error fetching roles:", error);
          return [];
        }
        return (data ?? []).map((r: any) => r.role);
      } catch (err) {
        console.error("fetchRoles exception:", err);
        return [];
      }
    };

    // Listen for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRoles(session.user.id).then((r) => {
            if (isMounted) setRoles(r);
          });
        } else {
          setRoles([]);
        }
      }
    );

    // INITIAL load - fetch roles BEFORE setting loading false
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setUser(session?.user ?? null);

        if (session?.user) {
          const userRoles = await fetchRoles(session.user.id);
          if (isMounted) setRoles(userRoles);
        }
      } catch (err) {
        console.error("initializeAuth error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const isSupervisor = roles.includes("supervisor");
  const isStudent = roles.includes("student");

  const signOut = () => supabase.auth.signOut();

  return { user, loading, roles, isAdmin, isTeacher, isSupervisor, isStudent, signOut };
}
