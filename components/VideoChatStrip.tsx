"use client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useAction, useMutation } from "convex/react";
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
  // The LiveKit video track itself. Each Tile attaches it to its OWN <video>
  // element, so the same track can render in the strip AND the pinned view
  // without the two fighting over a single shared element (which froze video
  // when un-pinning).
  track?: any;
  cameraOn: boolean;
  micOn: boolean;
  isLocal: boolean;
  isSpeaking: boolean;
  avatarUrl?: string;
};

export type VideoChatStripHandle = {
  presentToStage: () => Promise<void>;
  stopPresenting: () => Promise<void>;
};

type VideoChatStripProps = {
  roomId: Id<"rooms">;
  forceMicOff?: boolean;
  canShareScreen?: boolean;
  screenShareRequested?: boolean;
  pinnedKey?: string | null;
  onPin?: (key: string) => void;
  avatarByIdentity?: Record<string, string | null>;
  /** LiveKit identity of the room host — their screen goes to the main stage. */
  hostIdentity?: string;
  /** Fires with the host's screen-share track (or null) for the main stage. */
  onHostScreenTrack?: (track: Track | null) => void;
  /** Fires when the local host starts/stops presenting to the stage. */
  onPresentingChange?: (on: boolean) => void;
};

export const VideoChatStrip = forwardRef<VideoChatStripHandle, VideoChatStripProps>(
  function VideoChatStrip({
  roomId,
  forceMicOff = false,
  canShareScreen = true,
  screenShareRequested = false,
  pinnedKey = null,
  onPin,
  avatarByIdentity = {},
  hostIdentity,
  onHostScreenTrack,
  onPresentingChange,
}, ref) {
  const getToken = useAction(api.video.getToken);
  const requestScreenShare = useMutation(api.rooms.requestScreenShare);
  const cancelScreenShareRequest = useMutation(api.rooms.cancelScreenShareRequest);
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
  // The host's current screen-share track that's promoted to the main stage.
  const hostScreenTrackRef = useRef<Track | null>(null);

  // Expose present/stop controls to the page (the host's "Present screen" button).
  useImperativeHandle(ref, () => ({
    presentToStage: async () => {
      const lp = roomRef.current?.localParticipant as LocalParticipant | undefined;
      if (!lp) return;
      await lp.setScreenShareEnabled(true, { audio: true });
      setShareOn(true);
      rebuildTiles();
    },
    stopPresenting: async () => {
      const lp = roomRef.current?.localParticipant as LocalParticipant | undefined;
      if (!lp) return;
      await lp.setScreenShareEnabled(false);
      setShareOn(false);
      rebuildTiles();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Tell the page when the local host's presenting state changes.
  useEffect(() => {
    const lp = roomRef.current?.localParticipant;
    const iAmHost = hostIdentity && lp && String(lp.identity) === String(hostIdentity);
    if (iAmHost) onPresentingChange?.(shareOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOn, hostIdentity]);

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
    const camTrack = camPub?.track && !camPub.isMuted ? camPub.track : undefined;
    // (Audio is attached event-driven via TrackSubscribed — not here.)
    tiles.push({
      key: `${p.identity}:camera`,
      identity: p.identity,
      name: p.name || p.identity,
      kind: "camera",
      track: camTrack,
      cameraOn: !!camPub && !camPub.isMuted,
      micOn: !!micPub && !micPub.isMuted,
      isLocal,
      isSpeaking: false,
    });

    // ----- screen-share tile (only when actually sharing) -----
    // The host's screen is promoted to the main stage instead of the strip,
    // so skip it here.
    const isHostScreen = !!hostIdentity && String(p.identity) === String(hostIdentity);
    if (screenPub?.track && !screenPub.isMuted && !isHostScreen) {
      tiles.push({
        key: `${p.identity}:screen`,
        identity: p.identity,
        name: `${p.name || p.identity} (screen)`,
        kind: "screen",
        track: screenPub.track,
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

    // Promote the host's screen-share to the main stage (handled by the page).
    let stageTrack: Track | null = null;
    if (hostIdentity) {
      const findScreen = (p: Participant) => {
        const sp = p.getTrackPublication(Track.Source.ScreenShare);
        return sp?.track && !sp.isMuted ? (sp.track as Track) : null;
      };
      if (String(room.localParticipant.identity) === String(hostIdentity)) {
        stageTrack = findScreen(room.localParticipant);
      } else {
        const hp = [...room.remoteParticipants.values()].find(
          (p) => String(p.identity) === String(hostIdentity),
        );
        if (hp) stageTrack = findScreen(hp);
      }
    }
    const prevSid = hostScreenTrackRef.current?.sid ?? null;
    const nextSid = stageTrack?.sid ?? null;
    if (prevSid !== nextSid) {
      hostScreenTrackRef.current = stageTrack;
      onHostScreenTrack?.(stageTrack);
    }
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

    // Already sharing → just stop, no permission needed
    if (shareOn) {
      await lp.setScreenShareEnabled(false);
      setShareOn(false);
      rebuildTiles();
      return;
    }

    if (!canShareScreen) {
      // No permission yet — toggle a request to the host (or cancel one)
      if (screenShareRequested) {
        await cancelScreenShareRequest({ roomId });
      } else {
        await requestScreenShare({ roomId });
      }
      return;
    }

    await lp.setScreenShareEnabled(true, { audio: true });
    setShareOn(true);
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
                return {
                  ...t,
                  isSpeaking: t.kind === "camera" && speakers.has(t.identity),
                  avatarUrl: avatarByIdentity[t.identity] ?? undefined,
                };
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
              t={{
                ...t,
                isSpeaking: t.kind === "camera" && speakers.has(t.identity),
                avatarUrl: avatarByIdentity[t.identity] ?? undefined,
              }}
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
          <button
            className={`vc-btn ${shareOn ? "on" : ""} ${!canShareScreen && screenShareRequested ? "off" : ""}`}
            onClick={toggleShare}
            title={
              shareOn
                ? "Stop screen share"
                : canShareScreen
                  ? "Share your screen"
                  : screenShareRequested
                    ? "Waiting for host approval — click to cancel"
                    : "Ask host for screen-share permission"
            }
          >
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
});

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
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !t.track) return;
    try { t.track.attach(el); } catch {}
    return () => {
      try { t.track.detach(el); } catch {}
    };
  }, [t.track]);

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
        {t.avatarUrl ? (
          <img
            src={t.avatarUrl}
            alt=""
            style={{
              width: big ? 120 : 50,
              height: big ? 120 : 50,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--line)",
            }}
          />
        ) : (
          <div className="ph" />
        )}
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
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: isScreen ? "contain" : "cover" }}
      />
      <span className="nm">{t.isLocal && !isScreen ? "You" : t.name}</span>
      {!isScreen && !t.micOn && <span className="mic-off">✕</span>}
      {!big && <span className="pin-badge" aria-hidden>⛶</span>}
    </div>
  );
}
