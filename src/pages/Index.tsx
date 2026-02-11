import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { LessonTypes } from "@/components/home/LessonTypes";
import { OffersSection } from "@/components/home/OffersSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Wrench } from "lucide-react";

const Index = () => {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuthContext();

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "maintenance_mode").single()
      .then(({ data }) => {
        if (data && data.value === true) setMaintenance(true);
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
      <AnnouncementBanner />
      <LessonTypes />
      <OffersSection />
    </AppLayout>
  );
};

export default Index;
