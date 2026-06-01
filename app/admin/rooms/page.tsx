"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function AdminRoomsPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const [status, setStatus] = useState<"active" | "ended" | undefined>("active");
  const [openId, setOpenId] = useState<Id<"rooms"> | null>(null);
  const rooms = useQuery(api.admin.listRooms, canQuery ? { status, limit: 200 } : "skip");
  const deleteRoom = useMutation(api.admin.deleteRoom);

  return (
    <AdminShell title="Rooms" subtitle="Live watch parties & history">
      <div className="toolbar">
        <div className="seg">
          {(["active", "ended", undefined] as const).map((s) => (
            <button key={String(s)} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>
              {s ? s[0].toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
        <span className="spacer count-note">
          {rooms === undefined ? "…" : `${rooms.length} shown`}
        </span>
      </div>

      {rooms === undefined ? (
        <div className="loader">Loading…</div>
      ) : rooms.length === 0 ? (
        <div className="empty">No rooms found.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Room</th><th>Video</th><th>Host</th><th>Code</th><th>Privacy</th><th>Status</th><th>People</th><th>Created</th><th>Ended</th><th>Duration</th><th>Actions</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r._id} className="clickable" onClick={() => setOpenId(r._id as Id<"rooms">)}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td style={{ maxWidth: 220 }}>
                  <a
                    href={r.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={r.videoUrl}
                    style={{
                      color: "var(--cyan)", display: "block", maxWidth: 220,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    🎬 {r.videoTitle || r.videoUrl}
                  </a>
                </td>
                <td>
                  <div>{r.hostName}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{r.hostEmail}</div>
                </td>
                <td style={{ fontFamily: "Sora" }}>{r.code}</td>
                <td><span className={`badge ${r.privacy === "private" ? "priv" : "live"}`}>{r.privacy === "private" ? "Private" : "Link"}</span></td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{r.participantCount}</td>
                <td>{new Date(r._creationTime).toLocaleString()}</td>
                <td style={{ color: r.endedAt ? "var(--txt-2)" : "var(--txt-3)" }}>
                  {r.endedAt ? new Date(r.endedAt).toLocaleString() : "—"}
                </td>
                <td style={{ color: "var(--txt-3)" }}>
                  {formatDuration(r._creationTime, r.endedAt)}
                </td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost"
                    style={{ color: "var(--brand)" }}
                    onClick={() => {
                      if (confirm(`Permanently delete "${r.name}"? This removes the room and all its chat for everyone.`))
                        deleteRoom({ roomId: r._id as Id<"rooms"> });
                    }}
                  >
                    Delete
                  </button>
                </td>
                <td style={{ color: "var(--txt-3)", fontSize: 16 }}>›</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId && <RoomDrawer roomId={openId} onClose={() => setOpenId(null)} />}
    </AdminShell>
  );
}

function RoomDrawer({ roomId, onClose }: { roomId: Id<"rooms">; onClose: () => void }) {
  const data = useQuery(api.admin.getRoom, { roomId });
  const endRoom = useMutation(api.admin.endRoom);
  const deleteRoom = useMutation(api.admin.deleteRoom);
  const muteInRoom = useMutation(api.admin.muteInRoom);
  const kickFromRoom = useMutation(api.admin.kickFromRoom);
  const deleteMessage = useMutation(api.admin.deleteMessage);
  const ban = useMutation(api.admin.banUser);
  const [busy, setBusy] = useState(false);

  const room = data?.room;
  const live = data?.participants.filter((p) => !p.leftAt) ?? [];

  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <div className="drawer">
        {data === undefined || !room ? (
          <div className="loader">Loading…</div>
        ) : (
          <>
            <div className="drawer-head">
              <span className="av" style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🎬</span>
              <div>
                <h2>{room.name}</h2>
                <div className="ml">Host: {data.host?.displayName ?? "Unknown"}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <span className={`badge ${room.status}`}>{room.status}</span>
                  <span className={`badge ${room.privacy === "private" ? "priv" : "live"}`}>{room.privacy === "private" ? "Private" : "Link"}</span>
                  <span className="badge priv">{room.playbackState}</span>
                </div>
              </div>
              <button className="x" onClick={onClose}>×</button>
            </div>

            <div className="drawer-body">
              <div className="mini-stats">
                <div className="mini-stat"><div className="v">{live.length}</div><div className="l">In room</div></div>
                <div className="mini-stat"><div className="v">{data.participants.length}</div><div className="l">Total joined</div></div>
                <div className="mini-stat"><div className="v">{data.messages.length}</div><div className="l">Messages</div></div>
              </div>

              <div className="sec">Now watching</div>
              <div className="kv">
                <span className="k">Video</span>
                <span className="vv" style={{ maxWidth: 260, textAlign: "right" }}>{room.videoTitle ?? room.videoId}</span>
              </div>
              <div className="kv">
                <span className="k">URL</span>
                <a
                  href={room.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="vv"
                  style={{ color: "var(--cyan)", maxWidth: 260, textAlign: "right", overflowWrap: "anywhere" }}
                >
                  {room.videoUrl}
                </a>
              </div>
              <div className="kv">
                <span className="k">Access code</span>
                <span className="vv" style={{ fontFamily: "Sora" }}>{room.code}</span>
              </div>

              <div className="sec">Session</div>
              <div className="kv">
                <span className="k">Status</span>
                <span className="vv">
                  <span className={`badge ${room.status}`}>{room.status}</span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Created</span>
                <span className="vv">{new Date(room._creationTime).toLocaleString()}</span>
              </div>
              <div className="kv">
                <span className="k">Ended</span>
                <span className="vv">{room.endedAt ? new Date(room.endedAt).toLocaleString() : "— still active"}</span>
              </div>
              <div className="kv">
                <span className="k">Duration</span>
                <span className="vv">{formatDuration(room._creationTime, room.endedAt)}</span>
              </div>

              <div className="sec">Participants ({live.length} live)</div>
              {data.participants.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>Nobody here.</div>
              ) : (
                data.participants.map((p) => (
                  <div className="list-row" key={p._id} style={{ flexWrap: "wrap" }}>
                    <div>
                      <div className="t">
                        {p.displayName ?? "Unknown"}
                        {p.role === "host" && <span className="badge admin" style={{ marginLeft: 7 }}>Host</span>}
                        {p.mutedByHost && <span className="badge banned" style={{ marginLeft: 7 }}>Muted</span>}
                      </div>
                      <div className="s">{p.email}</div>
                    </div>
                    <span className={`badge ${p.leftAt ? "ended" : "active"} r`}>{p.leftAt ? "left" : "online"}</span>
                    {p.role !== "host" && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, width: "100%" }}>
                        <button className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 11 }} disabled={busy}
                          onClick={() => muteInRoom({ roomId, userId: p.userId, muted: !p.mutedByHost })}>
                          {p.mutedByHost ? "Unmute" : "Mute"}
                        </button>
                        {!p.leftAt && (
                          <button className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 11 }} disabled={busy}
                            onClick={() => { if (confirm(`Kick ${p.displayName}?`)) kickFromRoom({ roomId, userId: p.userId }); }}>
                            Kick
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 11, color: "var(--brand)" }} disabled={busy}
                          onClick={() => { if (confirm(`Ban ${p.displayName} from the platform?`)) ban({ userId: p.userId }); }}>
                          Ban
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              <div className="sec">Chat transcript</div>
              {data.messages.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>No messages.</div>
              ) : (
                <div className="transcript">
                  {data.messages.map((m) => (
                    <div className={`m${m.deletedAt ? " del" : ""}`} key={m._id} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span className="a">{m.authorName ?? "Unknown"}</span>
                      <span style={{ flex: 1 }}>{m.body}</span>
                      {!m.deletedAt && (
                        <button
                          title="Delete message"
                          onClick={() => deleteMessage({ messageId: m._id })}
                          style={{ background: "none", border: "none", color: "var(--txt-3)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="drawer-foot">
              {room.status === "active" && (
                <button className="btn btn-ghost" disabled={busy}
                  onClick={async () => {
                    if (!confirm("Force-end this room for everyone?")) return;
                    setBusy(true);
                    try { await endRoom({ roomId }); onClose(); } finally { setBusy(false); }
                  }}>Force-end room</button>
              )}
              <button className="btn btn-primary" disabled={busy}
                style={{ background: "linear-gradient(135deg,var(--brand),#c81e3c)" }}
                onClick={async () => {
                  if (!confirm(`Permanently delete "${room.name}"? This removes the room and all its chat for everyone, and can't be undone.`)) return;
                  setBusy(true);
                  try { await deleteRoom({ roomId }); onClose(); } finally { setBusy(false); }
                }}>Delete room</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Human-readable duration between room creation and end (or now, if active). */
function formatDuration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start;
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
