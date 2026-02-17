import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle, Copy, Server, Database, Video, Bell, Shield, Download, ArrowLeft, ArrowRight, Wrench } from "lucide-react";

interface SetupValues {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  zoomAccountId: string;
  zoomClientId: string;
  zoomClientSecret: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  oneSignalAppId: string;
}

const INITIAL_VALUES: SetupValues = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseServiceRoleKey: "",
  zoomAccountId: "",
  zoomClientId: "",
  zoomClientSecret: "",
  vapidPublicKey: "",
  vapidPrivateKey: "",
  oneSignalAppId: "",
};

const STEPS = [
  { id: "welcome", title: "مرحباً", icon: Server },
  { id: "database", title: "قاعدة البيانات", icon: Database },
  { id: "zoom", title: "Zoom", icon: Video },
  { id: "notifications", title: "الإشعارات", icon: Bell },
  { id: "finish", title: "إنهاء التثبيت", icon: Shield },
];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<SetupValues>(INITIAL_VALUES);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const updateValue = (key: keyof SetupValues, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setTestResult(null);
  };

  const testConnection = async () => {
    if (!values.supabaseUrl || !values.supabaseAnonKey) {
      toast.error("يرجى إدخال رابط ومفتاح Supabase أولاً");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${values.supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: values.supabaseAnonKey,
          Authorization: `Bearer ${values.supabaseAnonKey}`,
        },
      });
      if (res.ok || res.status === 200) {
        setTestResult("success");
        toast.success("تم الاتصال بقاعدة البيانات بنجاح!");
      } else {
        setTestResult("error");
        toast.error("فشل الاتصال، تحقق من البيانات");
      }
    } catch {
      setTestResult("error");
      toast.error("فشل الاتصال، تحقق من الرابط");
    }
    setTesting(false);
  };

  const generateEnvContent = () => {
    const projectId = values.supabaseUrl.replace("https://", "").replace(".supabase.co", "");
    return `VITE_SUPABASE_URL="${values.supabaseUrl}"
VITE_SUPABASE_PUBLISHABLE_KEY="${values.supabaseAnonKey}"
VITE_SUPABASE_PROJECT_ID="${projectId}"`;
  };

  const generateSecretsCommands = () => {
    const secrets: Record<string, string> = {};
    if (values.supabaseServiceRoleKey) secrets["SUPABASE_SERVICE_ROLE_KEY"] = values.supabaseServiceRoleKey;
    if (values.zoomAccountId) secrets["ZOOM_ACCOUNT_ID"] = values.zoomAccountId;
    if (values.zoomClientId) secrets["ZOOM_CLIENT_ID"] = values.zoomClientId;
    if (values.zoomClientSecret) secrets["ZOOM_CLIENT_SECRET"] = values.zoomClientSecret;
    if (values.vapidPublicKey) secrets["VAPID_PUBLIC_KEY"] = values.vapidPublicKey;
    if (values.vapidPrivateKey) secrets["VAPID_PRIVATE_KEY"] = values.vapidPrivateKey;

    return Object.entries(secrets)
      .map(([k, v]) => `supabase secrets set ${k}="${v}"`)
      .join("\n");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ!");
  };

  const next = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">معالج تثبيت المنصة</h1>
            <p className="text-xs text-muted-foreground">إعداد المنصة التعليمية على سيرفرك الخاص</p>
          </div>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={step.id} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => setCurrentStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${i < currentStep ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {currentStep === 0 && (
          <Card>
            <CardHeader className="text-center">
              <div className="h-20 w-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Server className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">مرحباً بك في معالج التثبيت</CardTitle>
              <CardDescription className="text-base mt-2">
                سيساعدك هذا المعالج على إعداد المنصة التعليمية على سيرفرك الخاص
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <h3 className="font-semibold">المتطلبات الأساسية:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> حساب Supabase مع مشروع جديد</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Node.js 18+ و npm مثبتان</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> حساب Zoom (اختياري - لحصص الفيديو)</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> مفاتيح VAPID (اختياري - للإشعارات)</li>
                </ul>
              </div>
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <h3 className="font-semibold">خطوات التثبيت:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>استنسخ المشروع من GitHub</li>
                  <li>شغّل <code className="bg-background px-1 rounded">npm install</code></li>
                  <li>أكمل هذا المعالج لإنشاء ملف الإعدادات</li>
                  <li>شغّل <code className="bg-background px-1 rounded">npm run build</code></li>
                  <li>ارفع مجلد <code className="bg-background px-1 rounded">dist</code> على سيرفرك</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" /> إعداد قاعدة البيانات (Supabase)
              </CardTitle>
              <CardDescription>
                أنشئ مشروع جديد على{" "}
                <a href="https://supabase.com" target="_blank" className="text-primary underline">supabase.com</a>
                {" "}ثم أدخل البيانات التالية
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>رابط المشروع (Project URL) <Badge variant="destructive" className="text-[10px] mr-1">مطلوب</Badge></Label>
                <Input
                  dir="ltr"
                  placeholder="https://xxxxx.supabase.co"
                  value={values.supabaseUrl}
                  onChange={(e) => updateValue("supabaseUrl", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>المفتاح العام (anon/public key) <Badge variant="destructive" className="text-[10px] mr-1">مطلوب</Badge></Label>
                <Input
                  dir="ltr"
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={values.supabaseAnonKey}
                  onChange={(e) => updateValue("supabaseAnonKey", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>مفتاح الخدمة (service_role key) <Badge variant="outline" className="text-[10px] mr-1">مطلوب لـ Edge Functions</Badge></Label>
                <Input
                  dir="ltr"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={values.supabaseServiceRoleKey}
                  onChange={(e) => updateValue("supabaseServiceRoleKey", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">يُستخدم في Edge Functions فقط ولا يُضمّن في الكود الأمامي</p>
              </div>

              <Separator />

              <Button onClick={testConnection} disabled={testing} variant="outline" className="w-full gap-2">
                {testing ? "جارٍ الاختبار..." : "اختبار الاتصال"}
                {testResult === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
              </Button>

              {testResult === "success" && (
                <div className="bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg p-3 text-sm text-center">
                  ✅ تم الاتصال بنجاح
                </div>
              )}
              {testResult === "error" && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm text-center">
                  ❌ فشل الاتصال - تحقق من البيانات
                </div>
              )}

              <div className="bg-muted rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-sm">📋 ملاحظة مهمة:</h4>
                <p className="text-xs text-muted-foreground">
                  بعد إنشاء مشروع Supabase، يجب تشغيل ملفات Migration الموجودة في مجلد
                  <code className="bg-background px-1 rounded mx-1">supabase/migrations/</code>
                  على قاعدة البيانات لإنشاء الجداول المطلوبة. استخدم الأمر:
                </p>
                <code className="block bg-background p-2 rounded text-xs" dir="ltr">
                  npx supabase db push --linked
                </code>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" /> إعداد Zoom (اختياري)
              </CardTitle>
              <CardDescription>
                مطلوب لإنشاء حصص فيديو تلقائياً. يمكنك تخطي هذه الخطوة وإعدادها لاحقاً.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-xl p-4 text-sm space-y-2">
                <p>للحصول على بيانات Zoom:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>اذهب إلى <a href="https://marketplace.zoom.us" target="_blank" className="text-primary underline">Zoom Marketplace</a></li>
                  <li>أنشئ تطبيق Server-to-Server OAuth</li>
                  <li>انسخ Account ID و Client ID و Client Secret</li>
                </ol>
              </div>
              <div className="space-y-2">
                <Label>Account ID</Label>
                <Input dir="ltr" placeholder="xxxxxxxx" value={values.zoomAccountId} onChange={(e) => updateValue("zoomAccountId", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input dir="ltr" placeholder="xxxxxxxx" value={values.zoomClientId} onChange={(e) => updateValue("zoomClientId", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input dir="ltr" type="password" placeholder="xxxxxxxx" value={values.zoomClientSecret} onChange={(e) => updateValue("zoomClientSecret", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> إعداد الإشعارات (اختياري)
              </CardTitle>
              <CardDescription>
                مطلوب لإرسال إشعارات Push للمستخدمين. يمكنك تخطي هذه الخطوة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-xl p-4 text-sm space-y-2">
                <p>لتوليد مفاتيح VAPID:</p>
                <code className="block bg-background p-2 rounded text-xs" dir="ltr">
                  npx web-push generate-vapid-keys
                </code>
              </div>
              <div className="space-y-2">
                <Label>VAPID Public Key</Label>
                <Input dir="ltr" placeholder="BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ=" value={values.vapidPublicKey} onChange={(e) => updateValue("vapidPublicKey", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>VAPID Private Key</Label>
                <Input dir="ltr" type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={values.vapidPrivateKey} onChange={(e) => updateValue("vapidPrivateKey", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader className="text-center">
              <div className="h-20 w-20 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <CardTitle className="text-2xl">جاهز للتثبيت!</CardTitle>
              <CardDescription>انسخ الملفات التالية وأضفها لمشروعك</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* .env file */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">📄 ملف <code>.env</code></Label>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => copyToClipboard(generateEnvContent())}>
                    <Copy className="h-3 w-3" /> نسخ
                  </Button>
                </div>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto" dir="ltr">
                  {generateEnvContent()}
                </pre>
                <p className="text-xs text-muted-foreground">أنشئ هذا الملف في المجلد الرئيسي للمشروع</p>
              </div>

              <Separator />

              {/* Supabase Secrets */}
              {generateSecretsCommands() && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">🔐 أوامر Supabase Secrets</Label>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copyToClipboard(generateSecretsCommands())}>
                      <Copy className="h-3 w-3" /> نسخ
                    </Button>
                  </div>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto" dir="ltr">
                    {generateSecretsCommands()}
                  </pre>
                  <p className="text-xs text-muted-foreground">شغّل هذه الأوامر في terminal بعد ربط مشروع Supabase</p>
                </div>
              )}

              <Separator />

              {/* Final Steps */}
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <h3 className="font-semibold">📋 خطوات ما بعد التثبيت:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>أنشئ ملف <code className="bg-background px-1 rounded">.env</code> في المجلد الرئيسي بالمحتوى أعلاه</li>
                  <li>
                    اربط مشروع Supabase:{" "}
                    <code className="bg-background px-1 rounded" dir="ltr">npx supabase link --project-ref YOUR_PROJECT_ID</code>
                  </li>
                  <li>
                    شغّل الـ Migrations:{" "}
                    <code className="bg-background px-1 rounded" dir="ltr">npx supabase db push</code>
                  </li>
                  <li>
                    أضف Secrets:{" "}
                    شغّل الأوامر أعلاه
                  </li>
                  <li>
                    انشر Edge Functions:{" "}
                    <code className="bg-background px-1 rounded" dir="ltr">npx supabase functions deploy</code>
                  </li>
                  <li>
                    ابنِ المشروع:{" "}
                    <code className="bg-background px-1 rounded" dir="ltr">npm run build</code>
                  </li>
                  <li>ارفع محتويات مجلد <code className="bg-background px-1 rounded">dist</code> على سيرفرك</li>
                </ol>
              </div>

              <Button
                className="w-full gap-2"
                variant="hero"
                onClick={() => {
                  const envContent = generateEnvContent();
                  const blob = new Blob([envContent], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = ".env";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("تم تحميل ملف .env");
                }}
              >
                <Download className="h-4 w-4" /> تحميل ملف .env
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={prev} disabled={currentStep === 0} className="gap-2">
            <ArrowRight className="h-4 w-4" /> السابق
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={next} className="gap-2">
              التالي <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="hero" onClick={() => window.location.href = "/"} className="gap-2">
              انتقل للمنصة <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
