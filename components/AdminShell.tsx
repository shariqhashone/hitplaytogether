"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { AuthBootstrap } from "./AuthBootstrap";

const groups: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "Insights",
    items: [
      { href: "/admin", label: "Overview", icon: "◎" },
      { href: "/admin/analytics", label: "Analytics", icon: "📈" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/admin/users", label: "Users", icon: "👥" },
      { href: "/admin/rooms", label: "Rooms", icon: "🎬" },
      { href: "/admin/reports", label: "Reports", icon: "🚩" },
    ],
  },
  {
    label: "Site",
    items: [{ href: "/admin/content", label: "Content (CMS)", icon: "📝" }],
  },
];

export function AdminShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/admin/login");
    else if (me === null) router.replace("/admin/login");
    else if (me && !me.isAdmin) router.replace("/");
  }, [me, router, isAuthenticated, isLoading]);

  if (isLoading || (isAuthenticated && me === undefined)) return <div className="loader">Loading…</div>;
  if (!isAuthenticated || !me || !me.isAdmin) return <div className="loader">Redirecting…</div>;

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
            <div className="badge-admin">● ADMIN CONSOLE</div>
          </div>

          {groups.map((g) => (
            <div key={g.label}>
              <div className="nav-group">{g.label}</div>
              <nav>
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} className={pathname === i.href ? "active" : ""}>
                    <span className="ic">{i.icon}</span>
                    <span>{i.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          ))}

          <div className="bottom">
            <div className="who">
              {me.avatarUrl ? (
                <img className="av" src={me.avatarUrl} alt="" />
              ) : (
                <span className="av" />
              )}
              <div>
                <div className="nm">{me.displayName}</div>
                <div className="ml">{me.email}</div>
              </div>
            </div>
            <button
              className="logout"
              onClick={async () => {
                await signOut();
                router.replace("/admin/login");
              }}
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-top">
            <div className="ttl">
              <h1>{title}</h1>
              {subtitle && <span className="sub">{subtitle}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {right}
              <Link href="/" className="btn btn-ghost btn-sm">View live site →</Link>
            </div>
          </div>
          <div className="admin-content">{children}</div>
        </main>
      </div>
    </>
  );
}
