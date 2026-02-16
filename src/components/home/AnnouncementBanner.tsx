import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState(0);

  const [bannerTitle, setBannerTitle] = useState("مرحباً بك في منصة تعليم");
  const [bannerDesc, setBannerDesc] = useState("أفضل منصة للدروس الخصوصية عبر الإنترنت");
  const [bannerImage, setBannerImage] = useState("");

  const loadData = () => {
    supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        setAnnouncements(data && data.length > 0 ? data : []);
      });

    supabase.from("site_settings").select("key, value").in("key", ["home_banner_title", "home_banner_description", "home_banner_image"])
      .then(({ data }) => {
        data?.forEach(s => {
          if (s.key === "home_banner_title" && typeof s.value === "string") setBannerTitle(s.value);
          if (s.key === "home_banner_description" && typeof s.value === "string") setBannerDesc(s.value);
          if (s.key === "home_banner_image" && typeof s.value === "string") setBannerImage(s.value);
        });
      });
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl mx-4 mt-4 h-40">
        {bannerImage ? (
          <img src={bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
        ) : null}
        <div className={`relative h-full rounded-xl p-8 text-foreground flex flex-col justify-center ${bannerImage ? "bg-black/40" : "gradient-hero"}`}>
          <h2 className="text-2xl font-bold mb-2">{bannerTitle}</h2>
          <p className="text-foreground/70">{bannerDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl mx-4 mt-4 h-40">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="absolute inset-0 gradient-hero rounded-xl p-6 flex flex-col justify-center text-foreground"
        >
          <h3 className="text-xl font-bold">{announcements[current].title}</h3>
          {announcements[current].description && (
            <p className="text-sm mt-1 text-foreground/70">{announcements[current].description}</p>
          )}
        </motion.div>
      </AnimatePresence>
      {announcements.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {announcements.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-primary-foreground w-5" : "bg-primary-foreground/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
