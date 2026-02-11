import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const defaultOffers = [
  { title: "خصم 20% على الحصة الأولى", description: "للطلاب الجدد فقط" },
  { title: "باقة 5 حصص", description: "وفر 15% عند شراء باقة" },
  { title: "مراجعة مجانية", description: "احصل على حصة مراجعة مجانية" },
  { title: "عرض الصيف", description: "خصومات حصرية على جميع المواد" },
];

export function OffersSection() {
  const [offers, setOffers] = useState<{ title: string; description: string; image_url?: string }[]>(defaultOffers);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "offers").single()
      .then(({ data }) => {
        if (data && Array.isArray(data.value) && data.value.length > 0) {
          setOffers(data.value as any);
        }
      });
  }, []);

  if (offers.length === 0) return null;

  return (
    <section className="px-4 mt-8 mb-8">
      <h2 className="text-lg font-bold mb-4">العروض والخصومات</h2>
      <div className="grid grid-cols-2 gap-3">
        {offers.map((offer, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-xl border border-border shadow-sm hover:shadow-elevated transition-shadow cursor-pointer overflow-hidden"
          >
            {offer.image_url && (
              <img src={offer.image_url} alt={offer.title} className="w-full h-24 object-cover" />
            )}
            <div className="p-4">
              {!offer.image_url && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Tag className="h-4 w-4 text-secondary" />
                  </div>
                </div>
              )}
              <h3 className="font-semibold text-sm">{offer.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{offer.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
