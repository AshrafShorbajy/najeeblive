import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on one or more tables and call `onRefresh` when any change occurs.
 * This ensures pages auto-update without manual refresh – critical for the Android app experience.
 */
export function useRealtimeRefresh(
  tables: { table: string; filter?: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*" }[],
  onRefresh: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const channelName = `rt-${tables.map(t => t.table).join("-")}-${Date.now()}`;
    let channel = supabase.channel(channelName);

    for (const { table, filter, event } of tables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: event ?? "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => onRefresh()
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, tables.map(t => `${t.table}:${t.filter || ""}:${t.event || "*"}`).join(",")]);
}
