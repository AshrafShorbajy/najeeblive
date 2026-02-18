import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import LessonsFilterPage from "./pages/LessonsFilterPage";
import LessonDetailPage from "./pages/LessonDetailPage";
import SchedulePage from "./pages/SchedulePage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import FavoritesPage from "./pages/FavoritesPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import SetupPage from "./pages/SetupPage";
import InstallWizard from "./pages/InstallWizard";
import ConnectSupabase from "./pages/ConnectSupabase";

const queryClient = new QueryClient();

const App = () => {
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    const apiBase = (import.meta as any).env?.DEV ? "http://localhost:4000/api" : "/api";
    fetch(`${apiBase}/installed`)
      .then((r) => r.json())
      .then((d) => setInstalled(!!d?.installed))
      .catch(() => setInstalled(false));
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CurrencyProvider>
              {installed === null ? (
                <div className="p-8 text-sm text-muted-foreground">Loading…</div>
              ) : installed === false ? (
                <Routes>
                  <Route path="/" element={<InstallWizard />} />
                  <Route path="/install" element={<InstallWizard />} />
                  <Route path="/connect" element={<ConnectSupabase />} />
                  <Route path="*" element={<InstallWizard />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/lessons/:type" element={<LessonsFilterPage />} />
                  <Route path="/lesson/:id" element={<LessonDetailPage />} />
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/setup" element={<SetupPage />} />
                  <Route path="/install" element={<InstallWizard />} />
                  <Route path="/connect" element={<ConnectSupabase />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              )}
            </CurrencyProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
