"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Brand } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { YouTubePlayer, YTPlayerHandle } from "@/components/YouTubePlayer";
import { VideoChatStrip } from "@/components/VideoChatStrip";

export default function WatchRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id as Id<"rooms">;
  const router = useRouter();

  const data = useQuery(api.rooms.get, { roomId });
  const messages = useQuery(api.messages.list, { roomId });
  const presence = useQuery(api.presence.forRoom, { roomId });
  const me = useQuery(api.users.me);

  const send = useMutation(api.messages.send);
  const setState = useMutation(api.presence.setState);
  const setPlayback = useMutation(api.rooms.setPlayback);
  const leave = useMutation(api.rooms.leave);
  const end = useMutation(api.rooms.end);

  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const handleRef = useRef<YTPlayerHandle | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  // presence heartbeat
  useEffect(() => {
    if (!data) return;
    setState({ roomId, state: "online" }).catch(() => {});
    const t = setInterval(() => setState({ roomId, state: "online" }).catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [data, roomId, setState]);

  // scroll chat to bottom on new message
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  // reconcile to host playback (every time state changes)
  useEffect(() => {
    if (!data || !handleRef.current) return;
    if (data.meIsHost) return; // host drives state
    const room = data.room;
    const expected =
      room.playbackPositionMs +
      (room.playbackState === "playing" ? Date.now() - room.playbackUpdatedAt : 0);
    const cur = handleRef.current.getPosition();
    if (Math.abs(cur - expected) > 1500) {
      handleRef.current.seekTo(expected);
    }
    if (room.playbackState === "playing") handleRef.current.play();
    else handleRef.current.pause();
  }, [
    data?.room.playbackState,
    data?.room.playbackPositionMs,
    data?.room.playbackUpdatedAt,
    data?.meIsHost,
    data,
  ]);

  if (data === undefined) return <div className="loader">Loading room…</div>;
  if (data === null) return <div className="loader">Room not found.</div>;

  const room = data.room;

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await send({ roomId, body });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function leaveRoom() {
    await leave({ roomId });
    router.push("/dashboard");
  }

  async function endRoom() {
    if (!confirm("End this room for everyone?")) return;
    await end({ roomId });
    router.push("/dashboard");
  }

  return (
    <>
      <AuthBootstrap />
      <div className="room-top">
        <div className="l">
          <Brand />
          {room.status === "active" && <span className="dot-live" />}
          <h3>{room.name}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="code" onClick={copyCode}>
            CODE {room.code} · {copied ? "Copied!" : "Copy"}
          </span>
          {data.meIsHost && (
            <button className="btn btn-ghost btn-sm" onClick={endRoom}>
              End room
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>
            Leave room
          </button>
        </div>
      </div>

      <div className="room-layout">
        <div className="stage">
          <div className="player">
            <YouTubePlayer
              videoId={room.videoId}
              isHost={data.meIsHost}
              registerHandle={(h) => (handleRef.current = h)}
              onUserPlay={(pos) =>
                setPlayback({ roomId, state: "playing", positionMs: pos }).catch(() => {})
              }
              onUserPause={(pos) =>
                setPlayback({ roomId, state: "paused", positionMs: pos }).catch(() => {})
              }
              onUserSeek={(pos) =>
                setPlayback({ roomId, state: room.playbackState, positionMs: pos }).catch(() => {})
              }
            />
          </div>

          <VideoChatStrip roomId={roomId} />

          <div className="now-playing">
            <div className="ic">▶</div>
            <div>
              <h4>Now playing — synced for everyone</h4>
              <p>
                {data.meIsHost
                  ? "You're the host — play/pause/seek to control the room."
                  : "The host controls playback. Your player follows automatically."}
              </p>
            </div>
          </div>
        </div>

        <div className="side">
          <div className="side-sec">
            <div className="h">
              <span>Participants</span>
              <span>
                {presence?.filter((p) => p.state !== "offline").length ?? data.participants.length} online
              </span>
            </div>
            <div className="ppl">
              {data.participants.map((p) => {
                const pr = presence?.find((x) => x.userId === p.userId);
                const st = pr?.state ?? "offline";
                return (
                  <div className="p" key={p.userId}>
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" />
                    ) : (
                      <span className="avatar" style={{ width: 28, height: 28, background: "var(--panel-2)" }} />
                    )}
                    <span className="nm">
                      {p.displayName}
                      {p.role === "host" && (
                        <span style={{ color: "var(--brand-2)", fontSize: 10, marginLeft: 6 }}>· Host</span>
                      )}
                    </span>
                    <span className={`st ${st === "typing" ? "typing" : st === "offline" ? "offline" : ""}`}>
                      {st}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="chat">
            <div
              className="h"
              style={{
                fontSize: 11, letterSpacing: ".6px", textTransform: "uppercase",
                color: "var(--txt-3)", fontWeight: 600, marginBottom: 12,
              }}
            >
              Live chat
            </div>
            <div className="chat-msgs" ref={msgsRef}>
              {messages === undefined ? (
                <div className="loader">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>No messages yet — say hi 👋</div>
              ) : (
                messages.map((m) => (
                  <div className={`msg ${m.isMe ? "me" : ""}`} key={m._id}>
                    {!m.isMe && m.authorAvatar && <img src={m.authorAvatar} alt="" />}
                    <div className="bd">
                      <div className="nm">{m.isMe ? "You" : m.authorName}</div>
                      <div className="tx">{m.body}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="chat-input" onSubmit={onSend}>
              <input
                className="field"
                placeholder="Send a message…"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setState({ roomId, state: e.target.value ? "typing" : "online" }).catch(() => {});
                }}
                onBlur={() => setState({ roomId, state: "online" }).catch(() => {})}
              />
              <button type="submit" className="send" disabled={!draft.trim()}>
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
