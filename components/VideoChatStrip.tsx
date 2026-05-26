"use client";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteParticipant,
  Participant,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteAudioTrack,
} from "livekit-client";

type TileKind = "camera" | "screen";
type TileState = {
  key: string;          // unique per (identity + kind)
  identity: string;
  name: string;
  kind: TileKind;
  videoEl?: HTMLVideoElement;
  cameraOn: boolean;
  micOn: boolean;
  isLocal: boolean;
  isSpeaking: boolean;
};

export function VideoChatStrip({
  roomId,
  forceMicOff = false,
  pinnedKey = null,
  onPin,
}: {
  roomId: Id<"rooms">;
  forceMicOff?: boolean;
  pinnedKey?: string | null;
  onPin?: (key: string) => void;
}) {
  const getToken = useAction(api.video.getToken);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [connected, setConnected] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [shareOn, setShareOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<Set<string>>(new Set());
  const roomRef = useRef<Room | null>(null);
  // Audio elements live in the DOM, keyed by track sid. They persist across
  // tile rebuilds — only torn down when the track itself unsubscribes.
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const { url, token } = await getToken({ roomId });
        if (cancelled) return;
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
        room.on(RoomEvent.TrackUnsubscribed, detachRemoteTrack);
        room.on(RoomEvent.ParticipantConnected, rebuildTiles);
        room.on(RoomEvent.ParticipantDisconnected, (p) => {
          // Clean up any cached audio elements for the leaver
          audioElsRef.current.forEach((el, sid) => {
            if (sid.startsWith(p.identity + ":")) {
              try { el.pause(); } catch {}
              el.srcObject = null;
              el.remove();
              audioElsRef.current.delete(sid);
            }
          });
          rebuildTiles();
        });
        room.on(RoomEvent.TrackMuted, rebuildTiles);
        room.on(RoomEvent.TrackUnmuted, rebuildTiles);
        room.on(RoomEvent.ActiveSpeakersChanged, (active) => {
          setSpeakers(new Set(active.map((p) => p.identity)));
        });

        await room.connect(url, token);
        await room.localParticipant.enableCameraAndMicrophone();
        setConnected(true);
        rebuildTiles();
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Could not connect to video chat");
      }
    }
    connect();
    return () => {
      cancelled = true;
      // Tear down all cached audio elements before disconnect
      audioElsRef.current.forEach((el) => {
        try { el.pause(); } catch {}
        el.srcObject = null;
        el.remove();
      });
      audioElsRef.current.clear();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function snapshotParticipant(p: Participant, isLocal: boolean): TileState[] {
    const tiles: TileState[] = [];
    const camPub = p.getTrackPublication(Track.Source.Camera);
    const micPub = p.getTrackPublication(Track.Source.Microphone);
    const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
    const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio);

    // ----- camera tile (always present, even if camera is off) -----
    let videoEl: HTMLVideoElement | undefined;
    if (camPub?.track && !camPub.isMuted) {
      videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      camPub.track.attach(videoEl);
    }
    // (Audio is attached event-driven via TrackSubscribed — not here.)
    tiles.push({
      key: `${p.identity}:camera`,
      identity: p.identity,
      name: p.name || p.identity,
      kind: "camera",
      videoEl,
      cameraOn: !!camPub && !camPub.isMuted,
      micOn: !!micPub && !micPub.isMuted,
      isLocal,
      isSpeaking: false,
    });

    // ----- screen-share tile (only when actually sharing) -----
    if (screenPub?.track && !screenPub.isMuted) {
      const screenVideoEl = document.createElement("video");
      screenVideoEl.autoplay = true;
      screenVideoEl.playsInline = true;
      screenVideoEl.muted = true;
      screenPub.track.attach(screenVideoEl);

      tiles.push({
        key: `${p.identity}:screen`,
        identity: p.identity,
        name: `${p.name || p.identity} (screen)`,
        kind: "screen",
        videoEl: screenVideoEl,
        cameraOn: true,
        micOn: true,
        isLocal,
        isSpeaking: false,
      });
    }

    return tiles;
  }

  function rebuildTiles() {
    const room = roomRef.current;
    if (!room) return;
    const next: TileState[] = [];
    next.push(...snapshotParticipant(room.localParticipant, true));
    room.remoteParticipants.forEach((p) => next.push(...snapshotParticipant(p, false)));
    // Screen shares first (they're the focus), then cameras
    next.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "screen" ? -1 : 1));
    setTiles(next);
  }

  function attachRemoteTrack(track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) {
    // Audio tracks need their own <audio> element so the browser plays sound.
    // We attach exactly once per track and keep the element alive until the
    // track unsubscribes — rebuilds no longer touch audio.
    if (track.kind === Track.Kind.Audio) {
      const key = `${p.identity}:${track.sid}`;
      let el = audioElsRef.current.get(key);
      if (!el) {
        el = document.createElement("audio");
        el.autoplay = true;
        el.style.display = "none";
        document.body.appendChild(el);
        audioElsRef.current.set(key, el);
      }
      (track as RemoteAudioTrack).attach(el);
    }
    rebuildTiles();
  }

  function detachRemoteTrack(track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      const key = `${p.identity}:${track.sid}`;
      const el = audioElsRef.current.get(key);
      if (el) {
        try { (track as RemoteAudioTrack).detach(el); } catch {}
        try { el.pause(); } catch {}
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(key);
      }
    }
    rebuildTiles();
  }

  async function toggleCam() {
    const lp = roomRef.current?.localParticipant as LocalParticipant | undefined;
    if (!lp) return;
    const next = !camOn;
    await lp.setCameraEnabled(next);
    setCamOn(next);
    rebuildTiles();
  }
  async function toggleMic() {
    const lp = roomRef.current?.localParticipant as LocalParticipant | undefined;
    if (!lp) return;
    if (forceMicOff && !micOn) {
      // Host has muted you — can't unmute yourself.
      return;
    }
    const next = !micOn;
    await lp.setMicrophoneEnabled(next);
    setMicOn(next);
    rebuildTiles();
  }

  // Enforce host-mute: whenever forceMicOff flips true, disable the mic.
  useEffect(() => {
    if (!forceMicOff) return;
    const lp = roomRef.current?.localParticipant as LocalParticipant | undefined;
    if (lp && micOn) {
      lp.setMicrophoneEnabled(false).catch(() => {});
      setMicOn(false);
      rebuildTiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceMicOff]);
  async function toggleShare() {
    const lp = roomRef.current?.localParticipant as LocalParticipant | undefined;
    if (!lp) return;
    const next = !shareOn;
    await lp.setScreenShareEnabled(next);
    setShareOn(next);
    rebuildTiles();
  }
  async function leaveCall() {
    await roomRef.current?.disconnect();
    setConnected(false);
    setTiles([]);
  }

  return (
    <>
      <div className="vc-strip">
        <div className="vc-head">
          <div className="t">
            🎥 Video chat · {tiles.filter((t) => t.cameraOn).length} on camera
          </div>
          <span style={{ fontSize: 11, color: "var(--txt-3)" }}>
            {connected ? "Connected" : err ? "Disconnected" : "Connecting…"}
          </span>
        </div>
        {pinnedKey && tiles.some((t) => t.key === pinnedKey) && (
          <div className="vc-pinned">
            <Tile
              big
              t={(() => {
                const t = tiles.find((x) => x.key === pinnedKey)!;
                return { ...t, isSpeaking: t.kind === "camera" && speakers.has(t.identity) };
              })()}
              onClick={() => onPin?.(pinnedKey)}
            />
          </div>
        )}
        <div className="vc-tiles">
          {tiles.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--txt-3)", padding: 20 }}>
              {err ?? "Setting up your camera…"}
            </div>
          )}
          {tiles.map((t) => (
            <Tile
              key={t.key}
              t={{ ...t, isSpeaking: t.kind === "camera" && speakers.has(t.identity) }}
              onClick={() => onPin?.(t.key)}
              pinned={pinnedKey === t.key}
            />
          ))}
        </div>
      </div>

      <div className="vc-controls">
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`vc-btn ${camOn ? "on" : "off"}`} onClick={toggleCam} title="Camera">
            {camOn ? "🎥" : "📷"}
          </button>
          <button className={`vc-btn ${micOn ? "on" : "off"}`} onClick={toggleMic} title="Microphone">
            {micOn ? "🎙️" : "🔇"}
          </button>
          <button className={`vc-btn ${shareOn ? "on" : ""}`} onClick={toggleShare} title="Screen share">
            🖥️
          </button>
        </div>
        <button className="vc-btn leave" onClick={leaveCall}>
          Leave call
        </button>
        <span className="meta">
          {connected ? (
            <>Video call connected · <b style={{ color: "var(--cyan)" }}>{tiles.length} on call</b></>
          ) : err ? (
            <span style={{ color: "var(--brand)" }}>{err}</span>
          ) : (
            "Connecting…"
          )}
        </span>
      </div>
    </>
  );
}

function Tile({
  t,
  onClick,
  pinned,
  big,
}: {
  t: TileState;
  onClick?: () => void;
  pinned?: boolean;
  big?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (t.videoEl && wrapRef.current) {
      wrapRef.current.innerHTML = "";
      wrapRef.current.appendChild(t.videoEl);
    }
  }, [t.videoEl]);

  const isScreen = t.kind === "screen";
  const speakingCls = t.isSpeaking ? "speaking" : "";
  const pinnedCls = pinned ? "is-pinned" : "";

  const tileStyle: React.CSSProperties = big
    ? { width: "100%", height: "auto", aspectRatio: "16 / 9", borderColor: isScreen ? "var(--violet)" : "var(--brand)" }
    : isScreen
      ? { width: 220, height: 124, borderColor: "var(--violet)" }
      : {};

  if (!t.cameraOn) {
    return (
      <div
        className={`vc-tile cam-off ${t.isLocal ? "you" : ""} ${speakingCls} ${pinnedCls}`}
        style={big ? { ...tileStyle, minHeight: 240 } : undefined}
        onClick={onClick}
        title={onClick ? (big ? "Click to unpin" : "Click to pin/expand") : undefined}
      >
        <div className="ph" />
        <span className="nm">{t.isLocal ? "You · camera off" : `${t.name} · camera off`}</span>
        {!t.micOn && <span className="mic-off">✕</span>}
      </div>
    );
  }
  return (
    <div
      className={`vc-tile ${t.isLocal && !isScreen ? "you" : ""} ${speakingCls} ${pinnedCls}`}
      style={tileStyle}
      onClick={onClick}
      title={onClick ? (big ? "Click to unpin" : "Click to pin/expand") : undefined}
    >
      <div ref={wrapRef} style={{ width: "100%", height: "100%" }} />
      <span className="nm">{t.isLocal && !isScreen ? "You" : t.name}</span>
      {!isScreen && !t.micOn && <span className="mic-off">✕</span>}
      {!big && <span className="pin-badge" aria-hidden>⛶</span>}
    </div>
  );
}
