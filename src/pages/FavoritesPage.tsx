import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Star, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function FavoritesPage() {
  const { user } = useAuthContext();
  const { format } = useCurrency();
  const [favorites, setFavorites] = useState<any[]>([]);

  const loadFavorites = () => {
    if (!user) return;
    supabase
      .from("favorites")
      .select("*, lessons(*)")
      .eq("user_id", user.id)
      .then(({ data }) => setFavorites(data ?? []));
  };

  useEffect(() => {
    loadFavorites();

    if (!user) return;
    const channel = supabase
      .channel("favorites-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` },
        () => loadFavorites())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const removeFav = async (id: string) => {
    await supabase.from("favorites").delete().eq("id", id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">المفضلة</h1>
        {favorites.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد دروس مفضلة</p>
        ) : (
          <div className="space-y-3">
            {favorites.map((f) => (
              <div key={f.id} className="bg-card rounded-xl p-4 border border-border flex items-center justify-between">
                <Link to={`/lesson/${f.lesson_id}`} className="flex-1">
                  <h3 className="font-semibold">{f.lessons?.title}</h3>
                  <p className="text-sm text-muted-foreground">{format(f.lessons?.price)}</p>
                </Link>
                <button onClick={() => removeFav(f.id)}>
                  <Heart className="h-5 w-5 text-destructive fill-current" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
