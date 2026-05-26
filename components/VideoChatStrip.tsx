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
  createLocalTracks,
} from "livekit-client";

type TileState = {
  identity: string;
  name: string;
  videoEl?: HTMLVideoElement;
  audioEl?: HTMLAudioElement;
  cameraOn: boolean;
  micOn: boolean;
  isLocal: boolean;
};

export function VideoChatStrip({ roomId }: { roomId: Id<"rooms"> }) {
  const getToken = useAction(api.video.getToken);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [connected, setConnected] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [shareOn, setShareOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

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
        room.on(RoomEvent.ParticipantDisconnected, rebuildTiles);
        room.on(RoomEvent.TrackMuted, rebuildTiles);
        room.on(RoomEvent.TrackUnmuted, rebuildTiles);

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
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function snapshotParticipant(p: Participant, isLocal: boolean): TileState {
    const camPub = p.getTrackPublication(Track.Source.Camera);
    const micPub = p.getTrackPublication(Track.Source.Microphone);

    let videoEl: HTMLVideoElement | undefined;
    if (camPub?.track && !camPub.isMuted) {
      videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true; // video element never carries audio — see audioEl
      camPub.track.attach(videoEl);
    }

    // Audio is a separate track. Only attach for REMOTE participants —
    // attaching the local mic would create an echo loop.
    let audioEl: HTMLAudioElement | undefined;
    if (!isLocal && micPub?.track && !micPub.isMuted) {
      audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      micPub.track.attach(audioEl);
      // Browsers block autoplay-with-sound until user gesture; append to DOM
      // so the existing user gesture (clicking "join") counts.
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
    }

    return {
      identity: p.identity,
      name: p.name || p.identity,
      videoEl,
      audioEl,
      cameraOn: !!camPub && !camPub.isMuted,
      micOn: !!micPub && !micPub.isMuted,
      isLocal,
    };
  }

  function rebuildTiles() {
    const room = roomRef.current;
    if (!room) return;
    // Detach the previous snapshot's hidden audio elements so we don't
    // stack one per rebuild.
    setTiles((prev) => {
      for (const t of prev) {
        if (t.audioEl) {
          try { t.audioEl.pause(); } catch {}
          t.audioEl.srcObject = null;
          t.audioEl.remove();
        }
      }
      const next: TileState[] = [];
      next.push(snapshotParticipant(room.localParticipant, true));
      room.remoteParticipants.forEach((p) => next.push(snapshotParticipant(p, false)));
      return next;
    });
  }

  function attachRemoteTrack(_track: RemoteTrack, _pub: RemoteTrackPublication, _p: RemoteParticipant) {
    rebuildTiles();
  }
  function detachRemoteTrack() { rebuildTiles(); }

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
    const next = !micOn;
    await lp.setMicrophoneEnabled(next);
    setMicOn(next);
    rebuildTiles();
  }
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
        <div className="vc-tiles">
          {tiles.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--txt-3)", padding: 20 }}>
              {err ?? "Setting up your camera…"}
            </div>
          )}
          {tiles.map((t) => (
            <Tile key={t.identity} t={t} />
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

function Tile({ t }: { t: TileState }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (t.videoEl && wrapRef.current) {
      wrapRef.current.innerHTML = "";
      wrapRef.current.appendChild(t.videoEl);
    }
  }, [t.videoEl]);

  if (!t.cameraOn) {
    return (
      <div className={`vc-tile cam-off ${t.isLocal ? "you" : ""}`}>
        <div className="ph" />
        <span className="nm">{t.isLocal ? "You · camera off" : `${t.name} · camera off`}</span>
        {!t.micOn && <span className="mic-off">✕</span>}
      </div>
    );
  }
  return (
    <div className={`vc-tile ${t.isLocal ? "you" : ""}`}>
      <div ref={wrapRef} style={{ width: "100%", height: "100%" }} />
      <span className="nm">{t.isLocal ? "You" : t.name}</span>
      {!t.micOn && <span className="mic-off">✕</span>}
    </div>
  );
}
