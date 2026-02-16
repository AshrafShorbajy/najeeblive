import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AnnouncementBanner() {
  const [bannerTitle, setBannerTitle] = useState("مرحباً بك في منصة تعليم");
  const [bannerDesc, setBannerDesc] = useState("أفضل منصة للدروس الخصوصية عبر الإنترنت");
  const [bannerImage, setBannerImage] = useState("");

  const loadData = () => {
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
      .channel("banner-settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
