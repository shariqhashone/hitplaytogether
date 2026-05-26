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
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatarMutation = useMutation(api.users.setAvatar);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [displayName, setName] = useState("");
  const [avatarUrl, setAvatar] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.displayName);
      setAvatar(me.avatarUrl ?? "");
    }
  }, [me]);

  async function onAvatarFile(file: File) {
    setErr(null); setMsg(null);
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image too large — keep it under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();
      await setAvatarMutation({ storageId });
      setMsg("Avatar updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Could not upload avatar");
    } finally {
      setUploading(false);
    }
  }

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
                  <label className="lbl">Profile photo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {me?.avatarUrl ? (
                      <img
                        src={me.avatarUrl}
                        alt=""
                        style={{
                          width: 64, height: 64, borderRadius: 16,
                          objectFit: "cover", border: "1px solid var(--line)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64, height: 64, borderRadius: 16,
                          background: "linear-gradient(135deg,var(--violet),var(--cyan))",
                        }}
                      />
                    )}
                    <label
                      className="btn btn-ghost btn-sm"
                      style={{ cursor: uploading ? "wait" : "pointer" }}
                    >
                      {uploading ? "Uploading…" : "Upload new photo"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onAvatarFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <span style={{ fontSize: 11, color: "var(--txt-3)" }}>
                      JPG/PNG/WebP · max 5 MB
                    </span>
                  </div>
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
