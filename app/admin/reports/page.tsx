"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Status = "open" | "investigating" | "resolved" | "dismissed";

export default function AdminReportsPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const [status, setStatus] = useState<Status | undefined>("open");
  const reports = useQuery(api.admin.listReports, canQuery ? { status, limit: 200 } : "skip");
  const update = useMutation(api.admin.updateReport);

  return (
    <AdminShell title="Moderation reports">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["open", "investigating", "resolved", "dismissed", undefined] as const).map((s) => (
          <button
            key={String(s)}
            className={`btn ${status === s ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setStatus(s)}
          >
            {s ?? "All"}
          </button>
        ))}
      </div>

      {reports === undefined ? <div className="loader">Loading…</div> :
       reports.length === 0 ? <div className="empty">No reports here.</div> :
      <table className="tbl">
        <thead><tr>
          <th>When</th><th>Reporter</th><th>Target</th><th>Type</th><th>Reason</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r._id}>
              <td>{new Date(r._creationTime).toLocaleString()}</td>
              <td>{r.reporterName}</td>
              <td>{r.targetName ?? "—"}</td>
              <td>{r.targetType}</td>
              <td>
                <div>{r.reason}</div>
                {r.details && <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 4 }}>{r.details}</div>}
              </td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
              <td className="actions">
                {r.status !== "investigating" && r.status !== "resolved" && r.status !== "dismissed" && (
                  <button className="btn btn-ghost" onClick={() => update({ reportId: r._id as Id<"reports">, status: "investigating" })}>Investigate</button>
                )}
                {r.status !== "resolved" && (
                  <button className="btn btn-primary" onClick={() => update({ reportId: r._id as Id<"reports">, status: "resolved" })}>Resolve</button>
                )}
                {r.status !== "dismissed" && (
                  <button className="btn btn-ghost" onClick={() => update({ reportId: r._id as Id<"reports">, status: "dismissed" })}>Dismiss</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>}
    </AdminShell>
  );
}
