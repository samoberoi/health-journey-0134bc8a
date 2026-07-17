import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Play, RotateCcw } from "lucide-react";
// Dynamically imported to avoid bundling issues when the native plugin
// isn't installed locally (e.g. before `npm install` on a fresh pull).
const loadYoutubePlayer = async () => {
  const mod = await import(
    /* @vite-ignore */ "@capgo/capacitor-youtube-player"
  );
  return (mod as any).YoutubePlayer;
};

type NativeYouTubePlayerProps = {
  videoId: string;
  title: string;
  start?: number;
  autoOpen?: boolean;
};

export default function NativeYouTubePlayer({
  videoId,
  title,
  start = 0,
  autoOpen = true,
}: NativeYouTubePlayerProps) {
  const playerIdRef = useRef(`bbdo-native-${videoId}-${Date.now()}`);
  const openedRef = useRef(false);
  const [launching, setLaunching] = useState(false);
  const [failed, setFailed] = useState(false);

  const openPlayer = useCallback(async () => {
    if (!videoId || launching) return;
    setLaunching(true);
    setFailed(false);

    try {
      const width = Math.max(320, Math.round(window.innerWidth || 390));
      const height = Math.max(180, Math.round(width * 9 / 16));
      await YoutubePlayer.initialize({
        playerId: playerIdRef.current,
        videoId,
        playerSize: { width, height },
        fullscreen: true,
        privacyEnhanced: true,
        autoplay: true,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 0,
          fs: 1,
          start: Math.max(0, Math.floor(start || 0)),
        },
      } as any);
      openedRef.current = true;
    } catch (error) {
      console.error("[native-youtube] player failed", error);
      setFailed(true);
    } finally {
      setLaunching(false);
    }
  }, [launching, start, videoId]);

  useEffect(() => {
    if (!autoOpen || openedRef.current) return;
    openedRef.current = true;
    void openPlayer();
  }, [autoOpen, openPlayer]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Maximize2 className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-black text-foreground">{title}</p>
        {failed ? (
          <p className="text-xs font-semibold text-destructive">Player could not start. Try again.</p>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">Opening in the in-app fullscreen player.</p>
        )}
      </div>
      <button
        type="button"
        onClick={openPlayer}
        disabled={launching}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-black text-primary-foreground disabled:opacity-60"
      >
        {failed ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {launching ? "Opening…" : failed ? "Retry" : "Play fullscreen"}
      </button>
    </div>
  );
}