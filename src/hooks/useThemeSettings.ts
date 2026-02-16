import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ThemeSettings {
  body_font_size: string;
  body_font_color: string;
  heading_font_size: string;
  heading_font_color: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
}

function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useThemeSettings() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apply = (theme: ThemeSettings) => {
      const root = document.documentElement;
      // Apply CSS custom properties for colors (HSL format for Tailwind)
      if (theme.primary_color) {
        const hsl = hexToHSL(theme.primary_color);
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--sidebar-primary", hsl);
        root.style.setProperty("--sidebar-ring", hsl);
      }
      if (theme.secondary_color) {
        const hsl = hexToHSL(theme.secondary_color);
        root.style.setProperty("--secondary", hsl);
        root.style.setProperty("--accent", hsl);
      }
      if (theme.background_color) {
        const bgHsl = hexToHSL(theme.background_color);
        root.style.setProperty("--background", bgHsl);
        root.style.setProperty("--sidebar-background", bgHsl);
      }

      // Apply font settings via CSS custom properties
      if (theme.body_font_size) root.style.setProperty("--theme-body-font-size", `${theme.body_font_size}px`);
      if (theme.body_font_color) root.style.setProperty("--theme-body-font-color", theme.body_font_color);
      if (theme.heading_font_size) root.style.setProperty("--theme-heading-font-size", `${theme.heading_font_size}px`);
      if (theme.heading_font_color) root.style.setProperty("--theme-heading-font-color", theme.heading_font_color);
    };

    supabase.from("site_settings").select("value").eq("key", "theme_settings").maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          apply(data.value as unknown as ThemeSettings);
        }
        setLoaded(true);
      });

    // Listen for realtime changes
    const channel = supabase
      .channel("theme-settings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings", filter: "key=eq.theme_settings" }, (payload) => {
        const val = (payload.new as any)?.value;
        if (val && typeof val === "object") apply(val as ThemeSettings);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return loaded;
}
