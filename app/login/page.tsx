"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Brand } from "@/components/Nav";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const bootstrap = useMutation(api.users.bootstrap);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      await bootstrap({});
      router.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed — check your email and password.");
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
          <Link href="/signup" className="btn btn-primary btn-sm">
            Sign up free
          </Link>
        </div>
      </nav>

      <div className="auth-wrap">
        <form className="auth-card" onSubmit={onSubmit}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <Brand />
          </div>
          <h2 style={{ textAlign: "center", fontSize: 21, margin: "16px 0 6px" }}>Welcome back</h2>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--txt-3)", marginBottom: 26 }}>
            Log in to rejoin the party
          </p>
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
            placeholder="Your password"
            style={{ marginBottom: 22 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--txt-3)", marginTop: 20 }}>
            New here? <Link href="/signup" style={{ color: "var(--brand)" }}>Create an account</Link>
          </p>
        </form>
      </div>

      <div className="foot-base">© 2026 HitPlayTogether.com — All rights reserved.</div>
    </>
  );
}
