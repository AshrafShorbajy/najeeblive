import { motion } from "framer-motion";
import { Tag } from "lucide-react";

const offers = [
  { id: 1, title: "خصم 20% على الحصة الأولى", description: "للطلاب الجدد فقط" },
  { id: 2, title: "باقة 5 حصص", description: "وفر 15% عند شراء باقة" },
  { id: 3, title: "مراجعة مجانية", description: "احصل على حصة مراجعة مجانية" },
  { id: 4, title: "عرض الصيف", description: "خصومات حصرية على جميع المواد" },
];

export function OffersSection() {
  return (
    <section className="px-4 mt-8 mb-8">
      <h2 className="text-lg font-bold mb-4">العروض والخصومات</h2>
      <div className="grid grid-cols-2 gap-3">
        {offers.map((offer, i) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-elevated transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Tag className="h-4 w-4 text-secondary" />
              </div>
            </div>
            <h3 className="font-semibold text-sm">{offer.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{offer.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
