"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });
  return apiPromise;
}

export type YTPlayerHandle = {
  play: () => void;
  pause: () => void;
  seekTo: (ms: number) => void;
  getPosition: () => number;
  getState: () => "playing" | "paused" | "other";
};

export function YouTubePlayer({
  videoId,
  isHost,
  onUserPlay,
  onUserPause,
  onUserSeek,
  registerHandle,
}: {
  videoId: string;
  isHost: boolean;
  onUserPlay?: (positionMs: number) => void;
  onUserPause?: (positionMs: number) => void;
  onUserSeek?: (positionMs: number) => void;
  registerHandle?: (h: YTPlayerHandle) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const lastFiredStateRef = useRef<number>(-1);

  useEffect(() => {
    let destroyed = false;
    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          controls: isHost ? 1 : 0,
          disablekb: isHost ? 0 : 1,
        },
        events: {
          onReady: () => {
            const h: YTPlayerHandle = {
              play: () => playerRef.current?.playVideo(),
              pause: () => playerRef.current?.pauseVideo(),
              seekTo: (ms) => playerRef.current?.seekTo(ms / 1000, true),
              getPosition: () => (playerRef.current?.getCurrentTime?.() ?? 0) * 1000,
              getState: () => {
                const s = playerRef.current?.getPlayerState?.();
                if (s === 1) return "playing";
                if (s === 2) return "paused";
                return "other";
              },
            };
            registerHandle?.(h);
          },
          onStateChange: (e: any) => {
            if (!isHost) return;
            // Debounce duplicate events
            if (lastFiredStateRef.current === e.data) return;
            lastFiredStateRef.current = e.data;
            const pos = (playerRef.current?.getCurrentTime?.() ?? 0) * 1000;
            if (e.data === 1) onUserPlay?.(pos);
            else if (e.data === 2) onUserPause?.(pos);
            else if (e.data === 3) onUserSeek?.(pos);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isHost]);

  return <div ref={containerRef} />;
}
