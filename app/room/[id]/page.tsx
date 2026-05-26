"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Brand } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { YouTubePlayer, YTPlayerHandle } from "@/components/YouTubePlayer";
import { VideoChatStrip } from "@/components/VideoChatStrip";
import { EmojiToggle, isMostlyEmoji } from "@/components/EmojiPicker";

export default function WatchRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id as Id<"rooms">;
  const router = useRouter();

  const { isAuthenticated } = useConvexAuth();
  const data = useQuery(api.rooms.get, isAuthenticated ? { roomId } : "skip");
  const messages = useQuery(api.messages.list, isAuthenticated ? { roomId } : "skip");
  const presence = useQuery(api.presence.forRoom, isAuthenticated ? { roomId } : "skip");
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");

  const send = useMutation(api.messages.send);
  const setState = useMutation(api.presence.setState);
  const setPlayback = useMutation(api.rooms.setPlayback);
  const leave = useMutation(api.rooms.leave);
  const end = useMutation(api.rooms.end);
  const setParticipantMute = useMutation(api.rooms.setParticipantMute);
  const kickParticipant = useMutation(api.rooms.kickParticipant);
  const setScreenSharePermission = useMutation(api.rooms.setScreenSharePermission);
  const joinByLink = useMutation(api.rooms.joinByLink);

  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [floats, setFloats] = useState<Array<{ id: number; emoji: string; left: number }>>([]);
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const floatIdRef = useRef(0);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [endedNotice, setEndedNotice] = useState<null | "ended" | "kicked">(null);
  const handleRef = useRef<YTPlayerHandle | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  // presence heartbeat
  useEffect(() => {
    if (!data) return;
    setState({ roomId, state: "online" }).catch(() => {});
    const t = setInterval(() => setState({ roomId, state: "online" }).catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [data, roomId, setState]);

  // auto-leave when room ends or the user is kicked
  useEffect(() => {
    if (!data) return;
    if (data.wasKicked) {
      setEndedNotice("kicked");
      const t = setTimeout(() => router.push("/dashboard"), 4000);
      return () => clearTimeout(t);
    }
    if (data.room.status === "ended") {
      setEndedNotice("ended");
      const t = setTimeout(() => router.push("/dashboard"), 4000);
      return () => clearTimeout(t);
    }
  }, [data?.room.status, data?.wasKicked, router, data]);

  // scroll chat to bottom on new message + spawn float for emoji-only messages
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
    if (!messages) return;
    // First load: mark all as seen so we don't spawn floats for history
    if (seenMsgIdsRef.current.size === 0) {
      for (const m of messages) seenMsgIdsRef.current.add(m._id);
      return;
    }
    for (const m of messages) {
      if (seenMsgIdsRef.current.has(m._id)) continue;
      seenMsgIdsRef.current.add(m._id);
      if (isMostlyEmoji(m.body)) {
        const chars = Array.from(m.body.replace(/\s/g, ""));
        for (const ch of chars) {
          const id = ++floatIdRef.current;
          const left = 8 + Math.random() * 70; // % across the stage
          setFloats((cur) => [...cur, { id, emoji: ch, left }]);
          setTimeout(() => setFloats((cur) => cur.filter((f) => f.id !== id)), 3200);
        }
      }
    }
  }, [messages]);

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

  // Access denied for private rooms: auto-redirect to /join-room.
  // For invite-link rooms, auto-join.
  useEffect(() => {
    if (!data) return;
    if ("accessDenied" in data && data.accessDenied) {
      if (data.privacy === "link") {
        joinByLink({ roomId }).catch(() => router.push("/dashboard"));
      } else {
        // Private — visitor needs the code
        const url = encodeURIComponent(`/room/${roomId}`);
        router.push(`/join-room?next=${url}`);
      }
    }
  }, [data, joinByLink, roomId, router]);

  if (data === undefined) return <div className="loader">Loading room…</div>;
  if (data === null) return <div className="loader">Room not found.</div>;
  if ("accessDenied" in data && data.accessDenied) {
    return (
      <div className="loader">
        {data.privacy === "link" ? "Joining room…" : "This room is private — redirecting…"}
      </div>
    );
  }

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
      const value =
        room.privacy === "link"
          ? `${window.location.origin}/room/${room._id}`
          : room.code;
      await navigator.clipboard.writeText(value);
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
      {endedNotice && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(10,10,15,.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 500, backdropFilter: "blur(8px)",
          }}
        >
          <div className="auth-card" style={{ textAlign: "center", width: 380 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>
              {endedNotice === "ended" ? "🎬" : "🚪"}
            </div>
            <h2 style={{ fontSize: 19, marginBottom: 8 }}>
              {endedNotice === "ended" ? "Room ended" : "Removed from room"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--txt-3)", marginBottom: 18 }}>
              {endedNotice === "ended"
                ? "The host ended this watch party."
                : "The host removed you from this room. You can rejoin with the room code if they share it again."}
            </p>
            <p style={{ fontSize: 11, color: "var(--txt-3)" }}>Returning to your dashboard…</p>
          </div>
        </div>
      )}
      <div className="room-top">
        <div className="l">
          <Brand />
          {room.status === "active" && <span className="dot-live" />}
          <h3>{room.name}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="code" onClick={copyCode}>
            {room.privacy === "link" ? "🔗 Invite link" : `CODE ${room.code}`} ·{" "}
            {copied ? "Copied!" : "Copy"}
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
        <div className="stage" style={{ position: "relative" }}>
          <div className="emoji-float-layer">
            {floats.map((f) => (
              <span key={f.id} className="emoji-float" style={{ left: `${f.left}%` }}>
                {f.emoji}
              </span>
            ))}
          </div>

          {data.meIsHost &&
            data.participants
              .filter((p) => p.screenShareRequestedAt)
              .map((p) => (
                <div className="share-request" key={p.userId}>
                  <span><b>{p.displayName}</b> wants to share their screen</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setScreenSharePermission({ roomId, userId: p.userId, allowed: false })
                      }
                    >
                      Deny
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        setScreenSharePermission({ roomId, userId: p.userId, allowed: true })
                      }
                    >
                      Allow
                    </button>
                  </div>
                </div>
              ))}
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

          <VideoChatStrip
            roomId={roomId}
            forceMicOff={data.myMutedByHost}
            canShareScreen={data.myCanShareScreen}
            screenShareRequested={!!data.myScreenShareRequestedAt}
            pinnedKey={pinnedKey}
            onPin={(k) => setPinnedKey((cur) => (cur === k ? null : k))}
            avatarByIdentity={Object.fromEntries(
              data.participants.map((p) => [String(p.userId), p.avatarUrl ?? null]),
            )}
          />

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
                const isSelf = p.userId === me?._id;
                return (
                  <div className="p" key={p.userId} style={{ flexWrap: "wrap" }}>
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" />
                    ) : (
                      <span className="avatar" style={{ width: 28, height: 28, background: "var(--panel-2)" }} />
                    )}
                    <span className="nm">
                      {isSelf ? "You" : p.displayName}
                      {p.role === "host" && (
                        <span style={{ color: "var(--brand-2)", fontSize: 10, marginLeft: 6 }}>· Host</span>
                      )}
                      {p.mutedByHost && (
                        <span style={{ color: "var(--brand)", fontSize: 10, marginLeft: 6 }}>· muted</span>
                      )}
                    </span>
                    <span className={`st ${st === "typing" ? "typing" : st === "offline" ? "offline" : ""}`}>
                      {st}
                    </span>
                    {data.meIsHost && !isSelf && p.role !== "host" && (
                      <div style={{ display: "flex", gap: 4, marginLeft: 38, marginTop: 4, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 8px", fontSize: 10 }}
                          onClick={() =>
                            setParticipantMute({
                              roomId,
                              userId: p.userId,
                              muted: !p.mutedByHost,
                            })
                          }
                        >
                          {p.mutedByHost ? "Unmute" : "Mute"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 8px", fontSize: 10, color: p.canShareScreen ? "var(--cyan)" : undefined }}
                          onClick={() =>
                            setScreenSharePermission({
                              roomId,
                              userId: p.userId,
                              allowed: !p.canShareScreen,
                            })
                          }
                        >
                          {p.canShareScreen ? "Revoke share" : "Allow share"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 8px", fontSize: 10, color: "var(--brand)" }}
                          onClick={() => {
                            if (confirm(`Kick ${p.displayName} from the room?`))
                              kickParticipant({ roomId, userId: p.userId });
                          }}
                        >
                          Kick
                        </button>
                      </div>
                    )}
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
            {data.myMutedByHost && (
              <div
                style={{
                  fontSize: 11, color: "var(--brand)", marginBottom: 8,
                  padding: "6px 10px", borderRadius: 8,
                  background: "rgba(255,77,109,.1)", border: "1px solid rgba(255,77,109,.3)",
                }}
              >
                🔇 You've been muted by the host. Your messages are hidden until the mute is lifted.
              </div>
            )}
            <form className="chat-input" onSubmit={onSend}>
              <input
                className="field"
                placeholder={data.myMutedByHost ? "You're muted by the host" : "Send a message…"}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setState({ roomId, state: e.target.value ? "typing" : "online" }).catch(() => {});
                }}
                onBlur={() => setState({ roomId, state: "online" }).catch(() => {})}
                disabled={data.myMutedByHost}
              />
              <EmojiToggle onPick={(em) => setDraft((d) => d + em)} />
              <button
                type="submit"
                className="send"
                disabled={!draft.trim() || data.myMutedByHost}
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
