import Link from "next/link";
import { Brand } from "./Nav";

export function Footer({ tagline, copyright }: { tagline?: string; copyright?: string }) {
  return (
    <>
      <footer className="site-foot">
        <div className="col brand-col">
          <Brand />
          <p>{tagline ?? "Watch together, in sync — wherever your friends are."}</p>
        </div>
        <div className="col">
          <h5>Product</h5>
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <Link href="/dashboard">Watch rooms</Link>
          <Link href="/signup">Sign up</Link>
        </div>
        <div className="col">
          <h5>Account</h5>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Create account</Link>
          <Link href="/profile">Profile</Link>
        </div>
        <div className="col">
          <h5>Legal</h5>
          <a href="#">Privacy policy</a>
          <a href="#">Terms of service</a>
        </div>
      </footer>
      <div className="foot-base">
        {copyright ?? "© 2026 HitPlayTogether.com — All rights reserved."}
      </div>
    </>
  );
}
