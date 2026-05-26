"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function AdminAnalyticsPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const [days, setDays] = useState(14);
  const signups = useQuery(api.admin.signups, canQuery ? { days } : "skip");
  const rooms = useQuery(api.admin.roomsActivity, canQuery ? { days } : "skip");
  const top = useQuery(api.admin.topHosts, canQuery ? { limit: 10 } : "skip");

  return (
    <AdminShell title="Analytics">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`btn ${days === d ? "btn-primary" : "btn-ghost"}`}
          >
            {d}d
          </button>
        ))}
      </div>
      <div className="charts">
        <div className="chart-card">
          <h3>New signups</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={signups ?? []}>
              <CartesianGrid stroke="#26263a" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#15151f", border: "1px solid #26263a", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#ff4d6d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Rooms created</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rooms ?? []}>
              <CartesianGrid stroke="#26263a" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#15151f", border: "1px solid #26263a", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#9d6bff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-card">
        <h3>Top hosts</h3>
        {top === undefined ? <div className="loader">Loading…</div> :
         top.length === 0 ? <div className="empty">No hosts yet.</div> :
        <table className="tbl">
          <thead><tr><th>#</th><th>Host</th><th>Email</th><th>Rooms hosted</th></tr></thead>
          <tbody>
            {top.map((t, i) => (
              <tr key={t.userId}>
                <td>{i + 1}</td>
                <td>{t.displayName}</td>
                <td>{t.email}</td>
                <td>{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </AdminShell>
  );
}
