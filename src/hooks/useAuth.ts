import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let initialized = false;

    const fetchRoles = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (error) {
          console.error("Error fetching roles:", error);
          return [];
        }
        return data?.map((r) => r.role) ?? [];
      } catch (err) {
        console.error("fetchRoles exception:", err);
        return [];
      }
    };

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (initialized) return;
      initialized = true;
      
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          const userRoles = await fetchRoles(session.user.id);
          setRoles(userRoles);
        }
      } catch (err) {
        console.error("getSession error:", err);
      } finally {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initialized) {
          initialized = true;
        }
        
        try {
          setUser(session?.user ?? null);
          if (session?.user) {
            const userRoles = await fetchRoles(session.user.id);
            setRoles(userRoles);
          } else {
            setRoles([]);
          }
        } catch (err) {
          console.error("onAuthStateChange error:", err);
        } finally {
          setLoading(false);
        }
      }
    );

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!initialized) {
        initialized = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const isSupervisor = roles.includes("supervisor");
  const isStudent = roles.includes("student");

  const signOut = () => supabase.auth.signOut();

  return { user, loading, roles, isAdmin, isTeacher, isSupervisor, isStudent, signOut };
}
