"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Status = "active" | "banned" | "deleted";

export default function AdminUsersPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const users = useQuery(api.admin.listUsers, canQuery ? { search, status, limit: 200 } : "skip");
  const ban = useMutation(api.admin.banUser);
  const unban = useMutation(api.admin.unbanUser);
  const del = useMutation(api.admin.deleteUser);

  return (
    <AdminShell title="Users">
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="field"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <select
          className="field"
          value={status ?? ""}
          onChange={(e) => setStatus((e.target.value || undefined) as Status | undefined)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--txt-3)" }}>
          {users === undefined ? "…" : `${users.length} shown`}
        </span>
      </div>

      {users === undefined ? <div className="loader">Loading…</div> :
       users.length === 0 ? <div className="empty">No users match.</div> :
      <table className="tbl">
        <thead><tr>
          <th>User</th><th>Email</th><th>Status</th><th>Joined</th><th>Last login</th><th></th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} className="avatar" alt="" /> :
                    <span className="avatar" style={{ background: "var(--panel-2)" }} />}
                  <div>
                    <div>{u.displayName}</div>
                    {u.isAdmin && <span style={{ fontSize: 10, color: "var(--brand-2)" }}>· Admin</span>}
                  </div>
                </div>
              </td>
              <td>{u.email}</td>
              <td><span className={`badge ${u.status}`}>{u.status}</span></td>
              <td>{new Date(u._creationTime).toLocaleDateString()}</td>
              <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
              <td className="actions">
                {u.status === "active" && !u.isAdmin && (
                  <button className="btn btn-ghost" onClick={() => ban({ userId: u._id as Id<"users"> })}>
                    Ban
                  </button>
                )}
                {u.status === "banned" && (
                  <button className="btn btn-ghost" onClick={() => unban({ userId: u._id as Id<"users"> })}>
                    Un-ban
                  </button>
                )}
                {u.status !== "deleted" && !u.isAdmin && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (confirm(`Delete ${u.displayName}? This anonymises their account.`))
                        del({ userId: u._id as Id<"users"> });
                    }}
                  >
                    Delete
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
