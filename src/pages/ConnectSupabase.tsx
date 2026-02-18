import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const schema = z.object({
  url: z.string().url(),
  anon: z.string().min(20),
});

type Values = z.infer<typeof schema>;

const ConnectSupabase = () => {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      url: (typeof window !== "undefined" && localStorage.getItem("supabaseUrlOverride")) || "",
      anon: (typeof window !== "undefined" && localStorage.getItem("supabaseAnonOverride")) || "",
    },
  });
  const [saved, setSaved] = useState(false);

  const onSubmit = (values: Values) => {
    localStorage.setItem("supabaseUrlOverride", values.url.trim());
    localStorage.setItem("supabaseAnonOverride", values.anon.trim());
    setSaved(true);
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Connect Supabase</h1>
      <p className="text-sm mb-6">
        Paste your Supabase Project URL and anon key. This overrides the app settings locally.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://yourref.supabase.co" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="anon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anon Key</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="anon key" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Save & Reload</Button>
          {saved && <div className="text-green-600 text-sm">Saved. Reloading…</div>}
        </form>
      </Form>
    </div>
  );
};

export default ConnectSupabase;
