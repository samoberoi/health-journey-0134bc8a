import { useMemo, useRef } from "react";
import { Maximize2 } from "lucide-react";
import { youtubePlayerProxyUrl } from "@/lib/youtubeEmbed";

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
  autoOpen: _autoOpen = true,
}: NativeYouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerSrc = useMemo(
    () => youtubePlayerProxyUrl(videoId, { autoplay: true, start }),
    [start, videoId],
  );

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