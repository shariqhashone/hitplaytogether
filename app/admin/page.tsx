"use client";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminOverviewPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const overview = useQuery(api.admin.overview, canQuery ? {} : "skip");
  const signups = useQuery(api.admin.signups, canQuery ? { days: 14 } : "skip");
  const rooms = useQuery(api.admin.roomsActivity, canQuery ? { days: 14 } : "skip");
  const audit = useQuery(api.admin.auditLog, canQuery ? { limit: 12 } : "skip");

  return (
    <AdminShell title="Overview">
      <div className="stat-row">
        <Stat lbl="Total users" val={overview?.totalUsers} />
        <Stat lbl="Active rooms" val={overview?.activeRooms} />
        <Stat lbl="Rooms today" val={overview?.roomsToday} />
        <Stat lbl="Messages today" val={overview?.messagesToday} />
        <Stat lbl="Open reports" val={overview?.openReports} highlight={!!overview && overview.openReports > 0} />
        <Stat lbl="Banned users" val={overview?.bannedUsers} />
      </div>

      <div className="charts">
        <div className="chart-card">
          <h3>New signups (14d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={signups ?? []}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#15151f", border: "1px solid #26263a", borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#ff4d6d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Rooms created (14d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rooms ?? []}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#15151f", border: "1px solid #26263a", borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#9d6bff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Recent admin actions</h3>
        {audit === undefined ? <div className="loader">Loading…</div> :
         audit.length === 0 ? <div className="empty">No admin actions yet.</div> :
        <table className="tbl">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a._id}>
                <td>{new Date(a._creationTime).toLocaleString()}</td>
                <td>{a.adminName}</td>
                <td>{a.action}</td>
                <td style={{ fontFamily: "Sora", fontSize: 11, color: "var(--txt-3)" }}>
                  {a.targetType ? `${a.targetType}:${a.targetId ?? ""}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </AdminShell>
  );
}

function Stat({ lbl, val, highlight }: { lbl: string; val: number | undefined; highlight?: boolean }) {
  return (
    <div className="stat-card">
      <div className="lbl">{lbl}</div>
      <div className="val" style={highlight ? { color: "var(--brand)" } : undefined}>
        {val === undefined ? "…" : val}
      </div>
    </div>
  );
}
