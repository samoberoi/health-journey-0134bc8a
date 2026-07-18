import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Maximize2, Play, RotateCcw } from "lucide-react";
import { isNativeAndroidApp, isNativeIOSApp, youtubePlayerProxyUrl } from "@/lib/youtubeEmbed";

type BBDOYouTubePlayerPlugin = {
  open(options: { videoId: string; title?: string; start?: number }): Promise<{ opened: boolean }>;
};

const BBDOYouTubePlayer = registerPlugin<BBDOYouTubePlayerPlugin>("BBDOYouTubePlayer");

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const openedRef = useRef(false);
  const [launching, setLaunching] = useState(false);
  const [failed, setFailed] = useState(false);
  const useIOSNativePlayer = isNativeIOSApp();
  const useAndroidSimpleEmbed = isNativeAndroidApp();
  const playerSrc = useMemo(
    () => youtubePlayerProxyUrl(videoId, {
      autoplay: !useAndroidSimpleEmbed,
      start,
      simple: useAndroidSimpleEmbed,
    }),
    [start, useAndroidSimpleEmbed, videoId],
  );

  const openIOSPlayer = useCallback(async () => {
    if (!videoId || launching) return;
    setLaunching(true);
    setFailed(false);
    try {
      // Suppress biometric re-lock for a generous window; the fullscreen
      // native player briefly resigns the WKWebView. We don't want Face ID
      // to fire when the user closes the video.
      (window as any).__bbdoBiometricSuppressUntil = Date.now() + 30 * 60 * 1000;
      // Announce open so JS parents can record start time for wall-clock credit.
      window.dispatchEvent(new CustomEvent("bbdo:native-player-open", { detail: { videoId } }));
      await BBDOYouTubePlayer.open({
        videoId,
        title,
        start: Math.max(0, Math.floor(start || 0)),
      });
      openedRef.current = true;
    } catch (error) {
      console.error("[native-youtube] iOS player failed", error);
      setFailed(true);
    } finally {
      setLaunching(false);
    }
  }, [launching, start, title, videoId]);

  useEffect(() => {
    if (!useIOSNativePlayer || !autoOpen || openedRef.current) return;
    openedRef.current = true;
    void openIOSPlayer();
  }, [autoOpen, openIOSPlayer, useIOSNativePlayer]);

  const enterFullscreen = () => {
    const frame = iframeRef.current;
    const requestFullscreen =
      frame?.requestFullscreen ||
      (frame as any)?.webkitRequestFullscreen ||
      (frame as any)?.mozRequestFullScreen ||
      (frame as any)?.msRequestFullscreen;
    try {
      requestFullscreen?.call(frame);
    } catch (_) {
      // The embedded YouTube controls still expose fullscreen when the WebView allows it.
    }
  };

  if (useIOSNativePlayer) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-5 text-center text-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white">
          <Maximize2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black">{title}</p>
          <p className="text-xs font-semibold text-white/70">
            {failed ? "The in-app player did not open. Try again." : "Opening the in-app fullscreen player."}
          </p>
        </div>
        <button
          type="button"
          onClick={openIOSPlayer}
          disabled={launching}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black disabled:opacity-60"
        >
          {failed ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {launching ? "Opening…" : failed ? "Retry" : "Play fullscreen"}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <iframe
        ref={iframeRef}
        src={playerSrc}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
      <button
        type="button"
        onClick={enterFullscreen}
        aria-label="Fullscreen"
        className="absolute bottom-3 right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-lg backdrop-blur"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}