import { supabase } from "@/integrations/supabase/client";

export interface VideoMetadataOverride {
  name?: string | null;
  category?: string | null;
  icon?: string | null;
  youtube_id?: string | null;
  group_name?: string | null;
  tags?: string[] | null;
  benefits?: string | null;
  suitable_for?: string | null;
  not_suitable_for?: string | null;
  dos?: string | null;
  donts?: string | null;
  is_enabled?: boolean;
  is_custom?: boolean;
  thumbnail_url?: string | null;
  updated_at?: string | null;
}

export type MetadataMap = Record<string, VideoMetadataOverride & { video_id: string }>;

export async function fetchVideoMetadataOverrides(): Promise<MetadataMap> {
  const { data, error } = await supabase
    .from("video_metadata")
    .select(
      "video_id, name, category, icon, youtube_id, group_name, tags, benefits, suitable_for, not_suitable_for, dos, donts, is_enabled, is_custom, thumbnail_url, updated_at",
    );
  if (error || !data) return {};
  const map: MetadataMap = {};
  for (const r of data as any[]) {
    map[r.video_id] = r;
  }
  return map;
}

export async function setVideoMetadata(videoId: string, patch: VideoMetadataOverride) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("video_metadata").upsert(
    {
      video_id: videoId,
      ...patch,
      updated_by: auth.user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "video_id" },
  );
  if (error) throw error;
}

export async function setVideoEnabled(videoId: string, enabled: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("video_metadata").upsert(
    {
      video_id: videoId,
      is_enabled: enabled,
      updated_by: auth.user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "video_id" },
  );
  if (error) throw error;
}

export async function createCustomVideo(patch: VideoMetadataOverride & { name: string; youtube_id: string }) {
  const { data: auth } = await supabase.auth.getUser();
  const videoId = `custom-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabase.from("video_metadata").insert({
    video_id: videoId,
    ...patch,
    is_custom: true,
    is_enabled: true,
    updated_by: auth.user?.id ?? null,
  });
  if (error) throw error;
  return videoId;
}

export async function deleteCustomVideo(videoId: string) {
  const { error } = await supabase.from("video_metadata").delete().eq("video_id", videoId);
  if (error) throw error;
}

export async function clearVideoMetadata(videoId: string) {
  const { error } = await supabase.from("video_metadata").delete().eq("video_id", videoId);
  if (error) throw error;
}
