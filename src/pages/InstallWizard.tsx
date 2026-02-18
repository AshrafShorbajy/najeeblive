import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";

const errorMessageFromCode = (code?: string) => {
  if (!code) return "Installation failed";
  switch (code) {
    case "INVALID_URL":
      return "Supabase URL is invalid. Use the Project URL like https://xxxx.supabase.co";
    case "INVALID_SERVICE_ROLE_KEY":
      return "Service Role Key is invalid. Use the Service Role key from Supabase settings";
    case "INVALID_EMAIL":
      return "Admin email is invalid";
    case "WEAK_PASSWORD":
      return "Admin password is too weak. Use 12+ chars with upper, lower, number, symbol";
    case "MIGRATION_FAILED":
    case "MIGRATION_ERROR":
      return "Database migration failed. Check Supabase URL and Service Role Key";
    case "MIGRATION_SYNTAX_ERROR":
      return "Migration SQL has a syntax error or unsupported statement";
    case "INVALID_PAT":
      return "PAT is invalid. Create a new Personal Access Token and try again";
    case "CREATE_USER_FAILED":
      return "Failed to create admin user. Check credentials and try again";
    case "ASSIGN_ROLE_FAILED":
      return "Failed to assign admin role. Check profiles table and policies";
    case "DB_CONNECTION_FAILED":
      return "Could not connect to the database. Check DB password and network";
    case "NETWORK_ERROR":
      return "Network error reaching Supabase. Check internet/firewall";
    case "CLIENT_INIT_FAILED":
      return "Failed to initialize Supabase client. Check URL/key format";
    case "DB_AUTH_FAILED":
      return "Database authentication failed. Verify DB password in Settings → Database";
    default:
      return "Installation failed";
  }
};

const schema = z.object({
  supabaseUrl: z.string().url(),
  serviceRoleKey: z.string().min(20),
  supabasePat: z.string().optional(),
  dbPassword: z.string().optional(),
  adminEmail: z.string().email(),
  adminPassword: z
    .string()
    .min(12)
    .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)),
  confirmPassword: z.string(),
}).refine((v) => v.adminPassword === v.confirmPassword, { path: ["confirmPassword"] });

type Values = z.infer<typeof schema>;

const InstallWizard = () => {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { supabaseUrl: "", serviceRoleKey: "", supabasePat: "", dbPassword: "", adminEmail: "", adminPassword: "", confirmPassword: "" } });

  const onSubmit = async (values: Values) => {
    setError(null);
    setErrorCode(null);
    setStatus("running");
    try {
      const apiBase = (import.meta as any).env?.DEV ? "http://localhost:4000/api" : `${window.location.origin}/api`;
      const r = await fetch(`${apiBase}/install`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supabaseUrl: values.supabaseUrl,
          serviceRoleKey: values.serviceRoleKey,
          supabasePat: values.supabasePat || undefined,
          dbPassword: values.dbPassword || undefined,
          adminEmail: values.adminEmail,
          adminPassword: values.adminPassword,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({} as any));
        setStatus("error");
        const code = (data as any)?.error?.code;
        setError(errorMessageFromCode(code));
        setErrorCode(code || null);
        return;
      }
      const data = await r.json();
      if (data && data.success) {
        setStatus("done");
        toast({ title: "Installation completed" });
      } else {
        setStatus("error");
        const code = (data as any)?.error?.code;
        setError(errorMessageFromCode(code));
        setErrorCode(code || null);
      }
    } catch {
      setStatus("error");
      setError("Network error");
      setErrorCode("NETWORK");
    }
  };

  return (
    <div className="container mx-auto max-w-xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Installation Wizard</CardTitle>
        </CardHeader>
        <CardContent>
          {status !== "done" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="supabaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supabase Project URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://xxxx.supabase.co" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supabasePat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supabase PAT (optional)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Personal Access Token" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dbPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Database Password (optional)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="DB password from Project Settings → Database" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceRoleKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supabase Service Role Key</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Service Role Key" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Strong password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={status === "running"}>Start Installation</Button>
                  {status === "running" && <span className="text-sm text-muted-foreground">Running…</span>}
                </div>
                {error && (
                  <div className="text-red-600 text-sm">
                    {error}
                    {errorCode && <span className="ml-2">({errorCode})</span>}
                  </div>
                )}
              </form>
            </Form>
          )}
          {status === "done" && (
            <div className="space-y-3">
              <div className="text-green-600 font-medium">Installation completed successfully</div>
              <div className="text-sm">Next, connect the app to your Supabase project.</div>
              <Button asChild>
                <a href="/auth">Go to Login</a>
              </Button>
              <Button variant="secondary" asChild>
                <a href="/connect">Connect Supabase</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallWizard;
