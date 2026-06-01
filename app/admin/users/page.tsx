"use client";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { friendlyError } from "@/lib/clientError";

type Status = "active" | "banned" | "deleted";

export default function AdminUsersPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [openId, setOpenId] = useState<Id<"appUsers"> | null>(null);
  const users = useQuery(api.admin.listUsers, canQuery ? { search, status, limit: 200 } : "skip");

  return (
    <AdminShell title="Users" subtitle="Accounts, roles & moderation">
      <div className="toolbar">
        <input
          className="field"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <div className="seg">
          {([undefined, "active", "banned", "deleted"] as const).map((s) => (
            <button key={String(s)} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>
              {s ? s[0].toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
        <span className="spacer count-note">
          {users === undefined ? "…" : `${users.length} shown`}
        </span>
      </div>

      {users === undefined ? (
        <div className="loader">Loading…</div>
      ) : users.length === 0 ? (
        <div className="empty">No users match.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th><th>Email</th><th>Status</th><th>Joined</th><th>Last login</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u._id} className="clickable" onClick={() => setOpenId(u._id as Id<"appUsers">)}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} className="av" alt="" /> :
                      <span className="av" style={{ background: "var(--panel-2)" }} />}
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span>{u.displayName}</span>
                      {u.isAdmin && <span className="badge admin">Admin</span>}
                    </div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className={`badge ${u.status}`}>{u.status}</span></td>
                <td>{new Date(u._creationTime).toLocaleDateString()}</td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                <td style={{ color: "var(--txt-3)", fontSize: 16 }}>›</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId && (
        <UserDrawer
          userId={openId}
          selfId={me?._id as Id<"appUsers"> | undefined}
          onClose={() => setOpenId(null)}
        />
      )}
    </AdminShell>
  );
}

function UserDrawer({
  userId, selfId, onClose,
}: {
  userId: Id<"appUsers">; selfId?: Id<"appUsers">; onClose: () => void;
}) {
  const data = useQuery(api.admin.getUser, { userId });
  const plans = useQuery(api.admin.listPlans, {});
  const ban = useMutation(api.admin.banUser);
  const unban = useMutation(api.admin.unbanUser);
  const del = useMutation(api.admin.deleteUser);
  const setAdmin = useMutation(api.admin.setUserAdmin);
  const setPlan = useMutation(api.admin.setUserPlan);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setErr(null); setBusy(true);
    try { await fn(); } catch (e: any) { setErr(friendlyError(e, "Action failed.")); }
    finally { setBusy(false); }
  }

  const u = data?.user;
  const isSelf = u && selfId && String(u._id) === String(selfId);

  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <div className="drawer">
        {data === undefined || !u ? (
          <div className="loader">Loading…</div>
        ) : (
          <>
            <div className="drawer-head">
              {u.avatarUrl ? <img className="av" src={u.avatarUrl} alt="" /> : <span className="av" />}
              <div>
                <h2>{u.displayName}</h2>
                <div className="ml">{u.email}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <span className={`badge ${u.status}`}>{u.status}</span>
                  {u.isAdmin && <span className="badge admin">Admin</span>}
                </div>
              </div>
              <button className="x" onClick={onClose}>×</button>
            </div>

            <div className="drawer-body">
              <div className="mini-stats">
                <div className="mini-stat"><div className="v">{data.rooms.length}</div><div className="l">Hosted</div></div>
                <div className="mini-stat"><div className="v">{data.roomsJoined}</div><div className="l">Joined</div></div>
                <div className="mini-stat"><div className="v">{data.messageCount}</div><div className="l">Messages</div></div>
              </div>

              <div className="sec">Role & plan</div>
              <div className="kv">
                <span className="k">Admin access</span>
                <label className="switch" title={isSelf ? "You can't change your own role" : ""}>
                  <input
                    type="checkbox"
                    checked={!!u.isAdmin}
                    disabled={busy || !!isSelf}
                    onChange={(e) => run(() => setAdmin({ userId: u._id, isAdmin: e.target.checked }))}
                  />
                  <span className="track" /><span className="knob" />
                </label>
              </div>
              <div className="kv">
                <span className="k">Plan</span>
                <select
                  className="field"
                  style={{ maxWidth: 180 }}
                  value={u.planId}
                  disabled={busy || !plans}
                  onChange={(e) => run(() => setPlan({ userId: u._id, planId: e.target.value as Id<"plans"> }))}
                >
                  {(plans ?? []).map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="kv">
                <span className="k">Joined</span>
                <span className="vv">{new Date(u._creationTime).toLocaleString()}</span>
              </div>
              <div className="kv">
                <span className="k">Last login</span>
                <span className="vv">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</span>
              </div>

              <div className="sec">Hosted rooms ({data.rooms.length})</div>
              {data.rooms.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>No rooms hosted.</div>
              ) : (
                data.rooms.slice(0, 8).map((r) => (
                  <div className="list-row" key={r._id}>
                    <div>
                      <div className="t">{r.name}</div>
                      <div className="s">{new Date(r._creationTime).toLocaleDateString()} · {r.code}</div>
                    </div>
                    <span className={`badge ${r.status} r`}>{r.status}</span>
                  </div>
                ))
              )}

              <div className="sec">Reports against ({data.reports.length})</div>
              {data.reports.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>No reports.</div>
              ) : (
                data.reports.map((rp) => (
                  <div className="list-row" key={rp._id}>
                    <div>
                      <div className="t">{rp.reason}</div>
                      <div className="s">{rp.details ?? "—"}</div>
                    </div>
                    <span className={`badge ${rp.status} r`}>{rp.status}</span>
                  </div>
                ))
              )}

              {err && <div className="err" style={{ marginTop: 14 }}>{err}</div>}
            </div>

            <div className="drawer-foot">
              {u.status === "active" && !u.isAdmin && (
                <button className="btn btn-ghost" disabled={busy}
                  onClick={() => run(() => ban({ userId: u._id }))}>Ban user</button>
              )}
              {u.status === "banned" && (
                <button className="btn btn-ghost" disabled={busy}
                  onClick={() => run(() => unban({ userId: u._id }))}>Un-ban</button>
              )}
              {u.status !== "deleted" && !u.isAdmin && (
                <button className="btn btn-primary" disabled={busy}
                  onClick={() => {
                    if (confirm(`Delete ${u.displayName}? This anonymises their account.`))
                      run(() => del({ userId: u._id }).then(onClose));
                  }}>Delete account</button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
