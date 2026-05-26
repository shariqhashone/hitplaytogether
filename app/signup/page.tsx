"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Brand } from "@/components/Nav";

export default function SignUpPage() {
  const { signIn } = useAuthActions();
  const bootstrap = useMutation(api.users.bootstrap);
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await signIn("password", { email, password, flow: "signUp" });
      await bootstrap({ displayName: displayName.trim() || undefined });
      router.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <nav className="nav">
        <Brand />
        <div className="nav-links">
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <a href="/#faq">FAQ</a>
        </div>
        <div className="nav-right">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Log in
          </Link>
        </div>
      </nav>

      <div className="auth-wrap">
        <form className="auth-card" onSubmit={onSubmit}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <Brand />
          </div>
          <h2 style={{ textAlign: "center", fontSize: 21, margin: "16px 0 6px" }}>
            Create your account
          </h2>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--txt-3)", marginBottom: 26 }}>
            Start hosting watch parties in seconds
          </p>

          <label className="lbl">Display name</label>
          <input
            className="field"
            placeholder="What should friends call you?"
            style={{ marginBottom: 16 }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <label className="lbl">Email address</label>
          <input
            className="field"
            type="email"
            placeholder="you@email.com"
            style={{ marginBottom: 16 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="lbl">Password</label>
          <input
            className="field"
            type="password"
            placeholder="Minimum 8 characters"
            style={{ marginBottom: 22 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--txt-3)", marginTop: 20 }}>
            Already have an account? <Link href="/login" style={{ color: "var(--brand)" }}>Log in</Link>
          </p>
        </form>
      </div>

      <div className="foot-base">© 2026 HitPlayTogether.com — All rights reserved.</div>
    </>
  );
}
