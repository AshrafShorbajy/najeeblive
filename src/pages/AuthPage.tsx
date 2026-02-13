import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteLogo, setSiteLogo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "site_logo").single()
      .then(({ data }) => {
        if (data && typeof data.value === "string" && data.value) setSiteLogo(data.value);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("تم تسجيل الدخول بنجاح");
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("تم إنشاء الحساب! يرجى تأكيد بريدك الإلكتروني");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background with gradient matching main page */}
      <div className="absolute inset-0 gradient-hero opacity-20" />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          {siteLogo ? (
            <img src={siteLogo} alt="لوجو الموقع" className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="h-16 w-16 mx-auto mb-4 rounded-2xl gradient-hero flex items-center justify-center shadow-elevated">
              <span className="text-2xl font-bold text-foreground">ت</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? "مرحباً بعودتك" : "انضم إلينا"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isLogin ? "سجل دخولك للمتابعة" : "أنشئ حسابك الجديد وابدأ رحلة التعلم"}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-elevated border border-border">
          {/* Toggle buttons */}
          <div className="flex gap-2 mb-6 bg-muted rounded-xl p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                !isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أدخل اسمك"
                  required={!isLogin}
                  dir="rtl"
                  className="h-11"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                dir="ltr"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                dir="ltr"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 text-base" variant="hero" disabled={loading}>
              {loading ? "جارٍ التحميل..." : isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          بالتسجيل أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
