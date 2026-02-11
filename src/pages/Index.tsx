import { AppLayout } from "@/components/layout/AppLayout";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { LessonTypes } from "@/components/home/LessonTypes";
import { OffersSection } from "@/components/home/OffersSection";

const Index = () => {
  return (
    <AppLayout>
      <AnnouncementBanner />
      <LessonTypes />
      <OffersSection />
    </AppLayout>
  );
};

export default Index;
