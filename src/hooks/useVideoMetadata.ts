import { useEffect, useMemo, useState, useCallback } from "react";
import {
  fetchVideoMetadataOverrides,
  type MetadataMap,
} from "@/lib/videoMetadataService";
import type { VideoEntry, VideoGroup, VideoTag } from "@/lib/exerciseData";

function ytThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function versionedThumbnail(url: string | null | undefined, updatedAt?: string | null) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}

export function useVideoMetadata() {
  const [overrides, setOverrides] = useState<MetadataMap>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await fetchVideoMetadataOverrides();
    setOverrides(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const resolveVideo = useCallback(
    (v: VideoEntry): VideoEntry => {
      const o = overrides[v.id];
      if (!o) return v;
      const youtubeId = o.youtube_id || v.youtubeId;
      const thumbnail = versionedThumbnail(o.thumbnail_url, (o as any).updated_at) ?? v.thumbnail;
      return {
        ...v,
        name: o.name ?? v.name,
        category: o.category ?? v.category,
        icon: o.icon ?? v.icon,
        group: (o.group_name as VideoEntry["group"]) ?? v.group,
        tags: (o.tags as VideoEntry["tags"]) ?? v.tags,
        benefits: o.benefits ?? v.benefits,
        suitableFor: o.suitable_for ?? v.suitableFor,
        notSuitableFor: o.not_suitable_for ?? v.notSuitableFor,
        dos: o.dos ?? v.dos,
        donts: o.donts ?? v.donts,
        thumbnail,
        youtubeId,
        youtubeUrl: `https://youtu.be/${youtubeId}`,
      };
    },
    [overrides],
  );

  const customVideos: VideoEntry[] = useMemo(() => {
    const list: VideoEntry[] = [];
    for (const o of Object.values(overrides)) {
      if (!o.is_custom) continue;
      const youtubeId = o.youtube_id || "";
      list.push({
        id: o.video_id,
        name: o.name || "Untitled",
        category: o.category || "",
        group: (o.group_name as VideoGroup) || "Yoga Asana",
        tags: (o.tags as VideoTag[]) || [],
        suitableFor: o.suitable_for || "",
        notSuitableFor: o.not_suitable_for || "",
        dos: o.dos || "",
        donts: o.donts || "",
        benefits: o.benefits || "",
        icon: o.icon || "🎬",
        thumbnail: versionedThumbnail(o.thumbnail_url, (o as any).updated_at) || (youtubeId ? ytThumb(youtubeId) : ""),
        youtubeId,
        youtubeUrl: youtubeId ? `https://youtu.be/${youtubeId}` : "",
      });
    }
    return list;
  }, [overrides]);

  const disabledIds = useMemo(() => {
    const s = new Set<string>();
    for (const o of Object.values(overrides)) {
      if (o.is_enabled === false) s.add(o.video_id);
    }
    return s;
  }, [overrides]);

  return { overrides, loading, reload, resolveVideo, customVideos, disabledIds };
}
