"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AppNav } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";

export default function CreateRoomPage() {
  const create = useMutation(api.rooms.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "link">("private");
  const [videoUrl, setVideoUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await create({ name, privacy, videoUrl });
      router.push(`/room/${r.roomId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not create room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthBootstrap />
      <AppNav />
      <div className="auth-wrap">
        <form className="auth-card" style={{ width: 440 }} onSubmit={onSubmit}>
          <span className="pill">New room</span>
          <h2 style={{ fontSize: 21, margin: "15px 0 4px" }}>Set up your watch room</h2>
          <p style={{ fontSize: 12.5, color: "var(--txt-3)", marginBottom: 24 }}>
            You&apos;ll be the host of this session.
          </p>

          <label className="lbl">Room name</label>
          <input
            className="field"
            placeholder="e.g. Friday Movie Night"
            style={{ marginBottom: 18 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />

          <label className="lbl">Privacy</label>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {(["private", "link"] as const).map((p) => (
              <div
                key={p}
                onClick={() => setPrivacy(p)}
                style={{
                  flex: 1,
                  border: `1px solid ${privacy === p ? "var(--brand)" : "var(--line)"}`,
                  background: privacy === p ? "rgba(255,77,109,.1)" : "var(--panel)",
                  borderRadius: 11,
                  padding: 13,
                  cursor: "pointer",
                  transition: ".15s",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {p === "private" ? "🔒 Private" : "🔗 Invite link"}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 3 }}>
                  {p === "private" ? "Code required" : "Anyone with link"}
                </div>
              </div>
            ))}
          </div>

          <label className="lbl">Video source</label>
          <input
            className="field"
            placeholder="Paste a YouTube URL"
            style={{ marginBottom: 7 }}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            required
          />
          <p style={{ fontSize: 10.5, color: "var(--txt-3)", marginBottom: 22 }}>
            Supported: YouTube videos only.
          </p>

          {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Creating…" : "Create room & enter →"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--txt-3)", marginTop: 16 }}>
            <Link href="/dashboard" style={{ color: "var(--txt-2)" }}>← Back to dashboard</Link>
          </p>
        </form>
      </div>
    </>
  );
}
