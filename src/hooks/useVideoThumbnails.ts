import { useEffect, useState, useCallback } from "react";
import { fetchThumbnailOverrides, type ThumbnailMap } from "@/lib/videoThumbnailService";

const THUMBNAILS_CHANGED_EVENT = "bbdo:video-thumbnails-changed";

export function notifyVideoThumbnailsChanged() {
  window.dispatchEvent(new CustomEvent(THUMBNAILS_CHANGED_EVENT));
}

export function useVideoThumbnails() {
  const [overrides, setOverrides] = useState<ThumbnailMap>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await fetchThumbnailOverrides();
    setOverrides(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(THUMBNAILS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(THUMBNAILS_CHANGED_EVENT, reload);
  }, [reload]);

  const resolve = useCallback(
    (videoId: string, fallback: string) => overrides[videoId] || fallback,
    [overrides],
  );

  return { overrides, loading, reload, resolve };
}
