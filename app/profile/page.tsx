"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AppNav } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { Footer } from "@/components/Footer";

export default function ProfilePage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const update = useMutation(api.users.updateProfile);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [displayName, setName] = useState("");
  const [avatarUrl, setAvatar] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.displayName);
      setAvatar(me.avatarUrl ?? "");
    }
  }, [me]);

  async function save() {
    setMsg(null); setErr(null); setBusy(true);
    try {
      await update({ displayName, avatarUrl });
      setMsg("Saved.");
    } catch (e: any) {
      setErr(e?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (me === undefined) {
    return (<><AuthBootstrap /><AppNav active="profile" /><div className="loader">Loading…</div></>);
  }

  return (
    <>
      <AuthBootstrap />
      <AppNav active="profile" />
      <div className="page-pad">
        <div className="wrap">
          <div className="profile">
            <div className="prof-head">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <div
                  style={{
                    width: 88, height: 88, borderRadius: 24,
                    background: "linear-gradient(135deg,var(--violet),var(--cyan))",
                  }}
                />
              )}
              <div>
                <h2>{me?.displayName}</h2>
                <p>{me?.email}</p>
              </div>
            </div>

            <div className="prof-card">
              <div className="sec-label" style={{ marginBottom: 20 }}>Account details</div>
              <div className="form-grid">
                <div>
                  <label className="lbl">Display name</label>
                  <input className="field" value={displayName} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="lbl">Email address</label>
                  <input className="field" value={me?.email ?? ""} disabled style={{ color: "var(--txt-3)" }} />
                </div>
                <div className="full">
                  <label className="lbl">Avatar URL</label>
                  <input
                    className="field"
                    placeholder="https://…"
                    value={avatarUrl}
                    onChange={(e) => setAvatar(e.target.value)}
                  />
                </div>
              </div>
              <div className="divider" />
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                >
                  Log out
                </button>
                <button className="btn btn-primary" onClick={save} disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
              {msg && <div className="err" style={{ color: "var(--cyan)" }}>{msg}</div>}
              {err && <div className="err">{err}</div>}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
