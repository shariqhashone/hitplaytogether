"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppNav } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { Footer } from "@/components/Footer";

type Filter = "all" | "hosting" | "joined" | "ended";

export default function MyRoomsPage() {
  const rooms = useQuery(api.rooms.myRooms);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = (rooms ?? []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "hosting") return r.role === "host" && r.status === "active";
    if (filter === "joined") return r.role === "participant" && r.status === "active";
    if (filter === "ended") return r.status === "ended";
    return true;
  });

  return (
    <>
      <AuthBootstrap />
      <AppNav active="rooms" />
      <div className="page-pad">
        <div className="wrap">
          <div className="dash-head">
            <h2>My <span>rooms</span></h2>
            <p>Every room you've hosted or joined.</p>
          </div>

          <div style={{ display: "flex", gap: 8, margin: "20px 0 20px", flexWrap: "wrap" }}>
            {(["all", "hosting", "joined", "ended"] as const).map((f) => (
              <button
                key={f}
                className={`btn ${filter === f ? "btn-primary" : "btn-ghost"} btn-sm`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
            <Link href="/create-room" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>
              + New room
            </Link>
          </div>

          {rooms === undefined ? (
            <div className="loader">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {filter === "all"
                ? "You haven't been in any rooms yet."
                : `No rooms match "${filter}".`}
            </div>
          ) : (
            <div className="room-grid">
              {filtered.map((r) => (
                <Link
                  href={r.status === "ended" ? "#" : `/room/${r._id}`}
                  key={r._id}
                  className="room-card"
                  style={r.status === "ended" ? { opacity: 0.55, pointerEvents: "none" } : undefined}
                >
                  <div className="room-thumb">
                    <img src={`https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`} alt="" />
                    {r.status === "active" && <span className="live">● LIVE</span>}
                    {r.status === "ended" && (
                      <span
                        className="live"
                        style={{ background: "var(--panel-2)", color: "var(--txt-3)", border: "1px solid var(--line)" }}
                      >
                        ENDED
                      </span>
                    )}
                    <div className="ov">
                      <span className="mini-play" />
                    </div>
                  </div>
                  <div className="meta">
                    <h4>{r.name}</h4>
                    <div className="sub">
                      👥 {r.participantCount} ·{" "}
                      {r.role === "host" ? "Hosting" : "Joined"} ·{" "}
                      <span style={{ fontFamily: "Sora" }}>{r.code}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
