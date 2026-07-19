import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { registerPlugin } from "@capacitor/core";
import { Maximize2, Play, RotateCcw } from "lucide-react";
import { isNativeAndroidApp, isNativeIOSApp, youtubePlayerProxyUrl } from "@/lib/youtubeEmbed";
import { markNativeVideoClosed, markNativeVideoOpen } from "@/lib/nativeVideoSession";

type BBDOYouTubePlayerPlugin = {
  open(options: { videoId: string; title?: string; start?: number }): Promise<{ opened?: boolean; closed?: boolean; elapsedSec?: number }>;
};

const BBDOYouTubePlayer = registerPlugin<BBDOYouTubePlayerPlugin>("BBDOYouTubePlayer");

type NativeYouTubePlayerProps = {
  videoId: string;
  title: string;
  start?: number;
  autoOpen?: boolean;
  onNativeClose?: (result?: { elapsedSec?: number }) => void;
};

export default function NativeYouTubePlayer({
  videoId,
  title,
  start = 0,
  autoOpen = true,
  onNativeClose,
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
    let didLaunch = false;
    let closeNotified = false;
    let openResult: { elapsedSec?: number } | undefined;
    const notifyClosed = (result?: { elapsedSec?: number }) => {
      if (closeNotified) return;
      closeNotified = true;
      markNativeVideoClosed();
      window.dispatchEvent(new CustomEvent("bbdo:native-player-close", { detail: { videoId, elapsedSec: result?.elapsedSec } }));
      setLaunching(false);
      // Unmount the React video modal immediately so the user lands on the
      // underlying app page — no spinner / empty screen while React catches up.
      onNativeClose?.(result);
    };
    try {
      markNativeVideoOpen();
      window.dispatchEvent(new CustomEvent("bbdo:native-player-open", { detail: { videoId } }));
      openResult = await BBDOYouTubePlayer.open({
        videoId,
        title,
        start: Math.max(0, Math.floor(start || 0)),
      });
      didLaunch = true;
      openedRef.current = true;
    } catch (error) {
      console.error("[native-youtube] iOS player failed", error);
      setFailed(true);
    } finally {
      if (didLaunch) notifyClosed(openResult);
      else {
        markNativeVideoClosed();
        window.dispatchEvent(new CustomEvent("bbdo:native-player-close", { detail: { videoId } }));
        setLaunching(false);
      }
    }
  }, [launching, onNativeClose, start, title, videoId]);



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