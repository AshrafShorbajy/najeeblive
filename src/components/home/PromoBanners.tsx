import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PromoBanner {
  title: string;
  description: string;
  image_url?: string;
  link_url?: string;
}

export function PromoBanners() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "promo_banners").single()
      .then(({ data }) => {
        if (data && Array.isArray(data.value) && data.value.length > 0) {
          setBanners(data.value as unknown as PromoBanner[]);
        }
      });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <section className="px-4 mt-6">
      <div className="relative overflow-hidden rounded-xl h-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {banners[current].image_url ? (
              <div className="relative h-full w-full">
                <img src={banners[current].image_url} alt={banners[current].title} className="w-full h-full object-cover rounded-xl" />
                <div className="absolute inset-0 bg-black/30 rounded-xl flex flex-col justify-center p-5">
                  <h3 className="text-white font-bold text-lg">{banners[current].title}</h3>
                  {banners[current].description && (
                    <p className="text-white/80 text-sm mt-1">{banners[current].description}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full gradient-secondary rounded-xl flex flex-col justify-center p-5 text-foreground">
                <h3 className="font-bold text-lg">{banners[current].title}</h3>
                {banners[current].description && (
                  <p className="text-foreground/70 text-sm mt-1">{banners[current].description}</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {banners.length > 1 && (
          <>
            <button onClick={() => setCurrent((c) => (c - 1 + banners.length) % banners.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full p-1 z-10">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrent((c) => (c + 1) % banners.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full p-1 z-10">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-5" : "bg-white/40"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
