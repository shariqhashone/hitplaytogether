"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const tip = { background: "#15151f", border: "1px solid #26263a", borderRadius: 8, fontSize: 12 };
const shortDay = (d: string) => d?.slice(5);

export default function AdminAnalyticsPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const [days, setDays] = useState(14);
  const signups = useQuery(api.admin.signups, canQuery ? { days } : "skip");
  const rooms = useQuery(api.admin.roomsActivity, canQuery ? { days } : "skip");
  const msgs = useQuery(api.admin.messagesActivity, canQuery ? { days } : "skip");
  const top = useQuery(api.admin.topHosts, canQuery ? { limit: 10 } : "skip");

  return (
    <AdminShell title="Analytics" subtitle="Growth & engagement trends">
      <div className="toolbar">
        <div className="seg">
          {[7, 14, 30, 90].map((d) => (
            <button key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d}d</button>
          ))}
        </div>
      </div>

      <div className="charts">
        <div className="chart-card">
          <h3>New signups</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={signups ?? []}>
              <CartesianGrid stroke="#26263a" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} tickFormatter={shortDay} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} width={24} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" fill="#ff4d6d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Rooms created</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rooms ?? []}>
              <CartesianGrid stroke="#26263a" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} tickFormatter={shortDay} />
              <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} width={24} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" fill="#9d6bff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 22 }}>
        <h3>Chat engagement · messages per day</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={msgs ?? []}>
            <defs>
              <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3de1d0" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3de1d0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#26263a" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6c6c82" }} tickFormatter={shortDay} />
            <YAxis tick={{ fontSize: 10, fill: "#6c6c82" }} allowDecimals={false} width={24} />
            <Tooltip contentStyle={tip} />
            <Area type="monotone" dataKey="count" stroke="#3de1d0" strokeWidth={2} fill="url(#gMsg)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Top hosts</h3>
          <span className="hint">all-time, by rooms hosted</span>
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
    </AdminShell>
  );
}
