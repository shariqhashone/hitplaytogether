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
  const rooms = useQuery(api.admin.listRooms, canQuery ? { status, limit: 200 } : "skip");
  const endRoom = useMutation(api.admin.endRoom);

  return (
    <AdminShell title="Rooms">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["active", "ended", undefined] as const).map((s) => (
          <button
            key={String(s)}
            onClick={() => setStatus(s)}
            className={`btn ${status === s ? "btn-primary" : "btn-ghost"}`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      {rooms === undefined ? <div className="loader">Loading…</div> :
       rooms.length === 0 ? <div className="empty">No rooms found.</div> :
      <table className="tbl">
        <thead><tr>
          <th>Room</th><th>Host</th><th>Code</th><th>Status</th><th>Participants</th><th>Created</th><th></th>
        </tr></thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r._id}>
              <td>{r.name}</td>
              <td>
                <div>{r.hostName}</div>
                <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{r.hostEmail}</div>
              </td>
              <td style={{ fontFamily: "Sora" }}>{r.code}</td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
              <td>{r.participantCount}</td>
              <td>{new Date(r._creationTime).toLocaleString()}</td>
              <td className="actions">
                {r.status === "active" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (confirm("Force-end this room?")) endRoom({ roomId: r._id as Id<"rooms"> });
                    }}
                  >
                    End
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>}
    </AdminShell>
  );
}
