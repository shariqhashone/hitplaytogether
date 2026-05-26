"use client";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Brand } from "@/components/Nav";

export default function AdminLoginPage() {
  const { signIn } = useAuthActions();
  const bootstrap = useMutation(api.users.bootstrap);
  const me = useQuery(api.users.me);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.isAdmin) router.replace("/admin");
  }, [me, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      const user = await bootstrap({});
      // re-fetch via reactive query will redirect via useEffect
      if (!user) throw new Error("Could not load admin account");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          <Brand />
        </div>
        <h2 style={{ textAlign: "center", fontSize: 21, margin: "16px 0 6px" }}>Admin sign in</h2>
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--txt-3)", marginBottom: 26 }}>
          Restricted to admin accounts
        </p>
        <label className="lbl">Email address</label>
        <input className="field" type="email" style={{ marginBottom: 16 }}
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="lbl">Password</label>
        <input className="field" type="password" style={{ marginBottom: 22 }}
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {me && !me.isAdmin && <div className="err" style={{ marginBottom: 12 }}>This account is not an admin.</div>}
        {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
