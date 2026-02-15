import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { LessonTypes } from "@/components/home/LessonTypes";
import { OffersSection } from "@/components/home/OffersSection";
import { PromoBanners } from "@/components/home/PromoBanners";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Wrench } from "lucide-react";

const DEFAULT_SECTIONS_ORDER = ["announcements", "promo_banners", "lesson_types", "offers"];

const SECTION_COMPONENTS: Record<string, React.FC> = {
  announcements: AnnouncementBanner,
  promo_banners: PromoBanners,
  lesson_types: LessonTypes,
  offers: OffersSection,
};

const Index = () => {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(DEFAULT_SECTIONS_ORDER);
  const { isAdmin } = useAuthContext();

  useEffect(() => {
    Promise.all([
      supabase.from("site_settings").select("value").eq("key", "maintenance_mode").single(),
      supabase.from("site_settings").select("value").eq("key", "homepage_sections_order").single(),
    ]).then(([maintRes, orderRes]) => {
      if (maintRes.data && maintRes.data.value === true) setMaintenance(true);
      if (orderRes.data && Array.isArray(orderRes.data.value) && orderRes.data.value.length > 0) {
        setSectionsOrder(orderRes.data.value as string[]);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div></AppLayout>;
  }

  if (maintenance && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="h-20 w-20 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Wrench className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">الموقع تحت الصيانة</h1>
          <p className="text-muted-foreground">نعمل على تحسين الموقع، يرجى المحاولة لاحقاً</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      {maintenance && isAdmin && (
        <div className="bg-destructive/10 text-destructive text-xs text-center p-2 flex items-center justify-center gap-1">
          <Wrench className="h-3 w-3" />
          الموقع في وضع الصيانة - مرئي لك فقط كأدمن
        </div>
      )}
      {sectionsOrder.map((sectionId) => {
        const Component = SECTION_COMPONENTS[sectionId];
        return Component ? <Component key={sectionId} /> : null;
      })}
    </AppLayout>
  );
};

export default Index;
