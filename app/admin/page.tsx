"use client";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminOverviewPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const ov = useQuery(api.admin.overview, canQuery ? {} : "skip");
  const signups = useQuery(api.admin.signups, canQuery ? { days: 14 } : "skip");
  const rooms = useQuery(api.admin.roomsActivity, canQuery ? { days: 14 } : "skip");
  const top = useQuery(api.admin.topHosts, canQuery ? { limit: 6 } : "skip");
  const audit = useQuery(api.admin.auditLog, canQuery ? { limit: 8 } : "skip");

  const growth =
    ov && ov.prevUsers7d > 0
      ? Math.round(((ov.newUsers7d - ov.prevUsers7d) / ov.prevUsers7d) * 100)
      : ov && ov.newUsers7d > 0
        ? 100
        : 0;

  return (
    <AdminShell
      title="Overview"
      subtitle="Real-time platform health"
      right={
        ov ? (
          <span className="live"><span className="dot" />{ov.onlineNow} online now</span>
        ) : null
      }
    >
      <div className="kpi-grid">
        <Kpi icon="👥" label="Total users" val={ov?.totalUsers} accent
          deltaText={`${growth >= 0 ? "+" : ""}${growth}% vs prev 7d`}
          deltaDir={growth > 0 ? "up" : growth < 0 ? "down" : "flat"}
          glow="rgba(255,77,109,.18)" />
        <Kpi icon="🟢" label="Online now" val={ov?.onlineNow}
          deltaText={`${ov?.liveParticipants ?? 0} in live rooms`} deltaDir="flat"
          glow="rgba(61,225,208,.16)" />
        <Kpi icon="🎬" label="Active rooms" val={ov?.activeRooms}
          deltaText={`${ov?.totalRooms ?? 0} all-time`} deltaDir="flat"
          glow="rgba(157,107,255,.16)" />
        <Kpi icon="💬" label="Messages today" val={ov?.messagesToday}
          deltaText={`${fmt(ov?.totalMessages)} total`} deltaDir="flat"
          glow="rgba(255,122,61,.16)" />
        <Kpi icon="🆕" label="New (7 days)" val={ov?.newUsers7d}
          deltaText={`${ov?.roomsToday ?? 0} rooms today`} deltaDir="flat"
          glow="rgba(61,225,208,.12)" />
        <Kpi icon="🚩" label="Open reports" val={ov?.openReports}
          deltaText={`${ov?.bannedUsers ?? 0} banned · ${ov?.adminUsers ?? 0} admins`} deltaDir="flat"
          glow="rgba(255,77,109,.16)"
          highlight={!!ov && ov.openReports > 0} />
      </div>

      <div className="charts">
        <div className="chart-card">
          <h3>New signups · 14 days</h3>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={signups ?? []}>
              <defs>
                <linearGradient id="gSign" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4d6d" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ff4d6d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} tickFormatter={shortDay} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} width={24} />
              <Tooltip contentStyle={tip} />
              <Area type="monotone" dataKey="count" stroke="#ff4d6d" strokeWidth={2} fill="url(#gSign)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Rooms created · 14 days</h3>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={rooms ?? []}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} tickFormatter={shortDay} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} width={24} />
              <Tooltip contentStyle={tip} />
              <Line type="monotone" dataKey="count" stroke="#9d6bff" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Recent admin actions</h3>
            <span className="hint">latest 8</span>
          </div>
          {audit === undefined ? (
            <div className="loader">Loading…</div>
          ) : audit.length === 0 ? (
            <div className="empty">No admin actions yet.</div>
          ) : (
            <div>
              {audit.map((a) => (
                <div className="kv" key={a._id}>
                  <div>
                    <div className="vv">{prettyAction(a.action)}</div>
                    <div className="k">{a.adminName} · {a.targetType ?? "—"}</div>
                  </div>
                  <span className="k">{timeAgo(a._creationTime)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Top hosts</h3>
            <span className="hint">by rooms hosted</span>
          </div>
          {top === undefined ? (
            <div className="loader">Loading…</div>
          ) : top.length === 0 ? (
            <div className="empty">No hosts yet.</div>
          ) : (
            <div className="lead">
              {top.map((t, i) => (
                <div className="row" key={t.userId}>
                  <span className="rk">{i + 1}</span>
                  <div>
                    <div className="nm">{t.displayName}</div>
                    <div className="ml">{t.email}</div>
                  </div>
                  <span className="ct">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

const tip = { background: "#15151f", border: "1px solid #26263a", borderRadius: 8, fontSize: 12 };

function Kpi({
  icon, label, val, deltaText, deltaDir = "flat", glow, accent, highlight,
}: {
  icon: string; label: string; val: number | undefined;
  deltaText?: string; deltaDir?: "up" | "down" | "flat";
  glow?: string; accent?: boolean; highlight?: boolean;
}) {
  if (val === undefined) return <div className="skel skel-kpi" />;
  const arrow = deltaDir === "up" ? "▲" : deltaDir === "down" ? "▼" : "•";
  return (
    <div className={`kpi${accent ? " accent" : ""}`} style={{ ["--kpi-glow" as any]: glow }}>
      <div className="ic">{icon}</div>
      <div className="lbl">{label}</div>
      <div className="val" style={highlight ? { color: "var(--brand)" } : undefined}>{fmt(val)}</div>
      {deltaText && (
        <div className={`delta ${deltaDir}`}>
          <span>{arrow}</span>{deltaText}
        </div>
      )}
    </div>
  );
}

function fmt(n: number | undefined) {
  if (n === undefined) return "…";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}
function shortDay(d: string) {
  return d?.slice(5); // MM-DD
}
function prettyAction(a: string) {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
