"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AppNav } from "@/components/Nav";
import { AuthBootstrap } from "@/components/AuthBootstrap";

export default function JoinRoomPage() {
  const join = useMutation(api.rooms.join);
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const code = digits.join("");

  function onDigit(i: number, v: string) {
    const ch = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) refs.current[i + 1]?.focus();
  }

  async function onJoin() {
    setErr(null);
    if (code.length !== 6) {
      setErr("Enter all 6 characters of the code.");
      return;
    }
    setBusy(true);
    try {
      const r = await join({ code });
      router.push(`/room/${r.roomId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthBootstrap />
      <AppNav />
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
              background: "linear-gradient(135deg,var(--violet),var(--cyan))",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25,
            }}
          >
            🎬
          </div>
          <h2 style={{ fontSize: 21, marginBottom: 6 }}>Join a watch room</h2>
          <p style={{ fontSize: 12.5, color: "var(--txt-3)", marginBottom: 24 }}>
            Enter the 6-character code your friend shared
          </p>

          <div className="code-boxes">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className="field"
                maxLength={1}
                value={d}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                }}
              />
            ))}
          </div>

          {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
          <button onClick={onJoin} className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Joining…" : "Join room"}
          </button>
          <p style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 18 }}>
            <Link href="/dashboard" style={{ color: "var(--txt-2)" }}>← Back to dashboard</Link>
          </p>
        </div>
      </div>
    </>
  );
}
