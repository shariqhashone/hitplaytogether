"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { AuthBootstrap } from "./AuthBootstrap";

const items = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/rooms", label: "Rooms", icon: "🎬" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/reports", label: "Reports", icon: "🚩" },
  { href: "/admin/content", label: "Content", icon: "📝" },
];

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const me = useQuery(api.users.me);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (me === null) router.replace("/admin/login");
    else if (me && !me.isAdmin) router.replace("/");
  }, [me, router]);

  if (me === undefined) return <div className="loader">Loading…</div>;
  if (!me || !me.isAdmin) return <div className="loader">Redirecting…</div>;

  return (
    <>
      <AuthBootstrap />
      <div className="admin-shell">
        <aside className="admin-side">
          <div className="logo">
            <Link href="/" className="brand">
              <span className="mark" />
              <span className="name">HitPlay<b>Together</b></span>
            </Link>
            <div style={{ marginTop: 6, fontSize: 10, letterSpacing: 1, color: "var(--brand)" }}>
              ADMIN
            </div>
          </div>
          <nav>
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={pathname === i.href ? "active" : ""}
              >
                <span>{i.icon}</span>
                <span>{i.label}</span>
              </Link>
            ))}
          </nav>
          <div className="bottom">
            Signed in as<br />
            <b style={{ color: "var(--txt-2)" }}>{me.displayName}</b>
            <br />
            <button
              onClick={async () => {
                await signOut();
                router.replace("/admin/login");
              }}
              style={{ marginTop: 10, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11 }}
            >
              Log out
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <div className="admin-top">
            <h1>{title}</h1>
            <Link href="/" className="btn btn-ghost btn-sm">View live site →</Link>
          </div>
          <div className="admin-content">{children}</div>
        </main>
      </div>
    </>
  );
}
