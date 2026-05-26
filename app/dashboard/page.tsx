"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AppNav } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";

export default function DashboardPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const rooms = useQuery(api.rooms.myRooms, isAuthenticated ? {} : "skip");
  const join = useMutation(api.rooms.join);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onJoin() {
    setErr(null);
    if (!code.trim()) return;
    try {
      const r = await join({ code });
      router.push(`/room/${r.roomId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not join room");
    }
  }

  return (
    <>
      <AuthBootstrap />
      <AppNav active="home" />
      <div className="page-pad">
        <div className="wrap">
          <div className="dash-head">
            <h2>
              Hey <span>{me?.displayName?.split(" ")[0] ?? "there"}</span> 👋
            </h2>
            <p>Start a new watch party or jump back into a room.</p>
          </div>

          <div className="action-row">
            <div className="action-card create">
              <h3>Create a watch room</h3>
              <p>Set up a private room, drop in a video link, and invite your crew.</p>
              <Link href="/create-room" className="btn btn-primary">
                Create room →
              </Link>
            </div>
            <div className="action-card join">
              <h3>Join with a code</h3>
              <p>Got an invite code from a friend?</p>
              <div className="code-row">
                <input
                  className="field"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button onClick={onJoin} className="btn btn-ghost">Join</button>
              </div>
              {err && <div className="err">{err}</div>}
            </div>
          </div>

          <div id="rooms">
            <div className="sec-label">Recent rooms</div>
            {rooms === undefined ? (
              <div className="loader">Loading…</div>
            ) : rooms.length === 0 ? (
              <div className="empty">No rooms yet — create your first watch party above.</div>
            ) : (
              <div className="room-grid">
                {rooms.map((r) => (
                  <Link href={`/room/${r._id}`} key={r._id} className="room-card">
                    <div className="room-thumb">
                      <img
                        src={`https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`}
                        alt=""
                      />
                      {r.status === "active" && <span className="live">● LIVE</span>}
                      <div className="ov">
                        <span className="mini-play" />
                      </div>
                    </div>
                    <div className="meta">
                      <h4>{r.name}</h4>
                      <div className="sub">
                        👥 {r.participantCount} · {r.role === "host" ? "Hosting" : "Joined"} · code{" "}
                        <span style={{ fontFamily: "Sora" }}>{r.code}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
