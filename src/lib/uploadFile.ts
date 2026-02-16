import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to Supabase Storage in a way that works reliably
 * on Android WebViews (Median.co / GoNative) by reading the File
 * into an ArrayBuffer first, then uploading the resulting Uint8Array.
 */
export async function uploadFileCompat(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<{ publicUrl: string }> {
  // Read the file as ArrayBuffer – works in all environments
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, uint8, {
      contentType: file.type || "application/octet-stream",
      upsert: options?.upsert ?? false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { publicUrl };
}
