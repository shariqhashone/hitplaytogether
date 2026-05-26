"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="mark" />
      <span className="name">
        HitPlay<b>Together</b>
      </span>
    </Link>
  );
}

export function PublicNav() {
  return (
    <nav className="nav">
      <Brand />
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#usecases">Use cases</a>
        <a href="#faq">FAQ</a>
      </div>
      <div className="nav-right">
        <Link href="/login" className="btn btn-ghost btn-sm">
          Log in
        </Link>
        <Link href="/signup" className="btn btn-primary btn-sm">
          Sign up free
        </Link>
      </div>
    </nav>
  );
}

export function AppNav({ active }: { active?: "home" | "rooms" | "profile" }) {
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <nav className="nav">
      <Brand />
      <div className="nav-links">
        <Link href="/dashboard" className={active === "home" ? "active" : ""}>
          Home
        </Link>
        <Link href="/dashboard#rooms" className={active === "rooms" ? "active" : ""}>
          My rooms
        </Link>
        <Link href="/profile" className={active === "profile" ? "active" : ""}>
          Profile
        </Link>
      </div>
      <div className="nav-right">
        <Link href="/create-room" className="btn btn-primary btn-sm">
          + New room
        </Link>
        <Link href="/profile">
          {me?.avatarUrl ? (
            <img className="avatar" src={me.avatarUrl} alt="" />
          ) : (
            <span className="avatar" style={{ background: "var(--panel-2)" }} />
          )}
        </Link>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
