"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicNav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/**
 * Public platform documentation — a single shareable page that explains
 * everything HitPlayTogether does, for both end users and admins.
 * No login required so it can be sent directly to clients.
 */

type Section = { id: string; label: string };

const NAV: { group: string; items: Section[] }[] = [
  {
    group: "Getting started",
    items: [
      { id: "overview", label: "What is HitPlayTogether" },
      { id: "start", label: "Create your account" },
      { id: "concepts", label: "Key concepts" },
    ],
  },
  {
    group: "Watching together",
    items: [
      { id: "create", label: "Creating a room" },
      { id: "invite", label: "Inviting people" },
      { id: "join", label: "Joining & approval" },
      { id: "sync", label: "Synced video" },
      { id: "video-chat", label: "Live video & chat" },
      { id: "screen-share", label: "Host screen sharing" },
      { id: "rooms", label: "Managing your rooms" },
    ],
  },
  {
    group: "Admin dashboard",
    items: [
      { id: "admin-overview", label: "Overview & analytics" },
      { id: "admin-users", label: "Managing users" },
      { id: "admin-rooms", label: "Managing rooms" },
      { id: "admin-content", label: "Editing site content" },
      { id: "admin-settings", label: "Platform settings" },
    ],
  },
  {
    group: "More",
    items: [
      { id: "faq", label: "FAQ" },
    ],
  },
];

export default function DocsPage() {
  const [active, setActive] = useState("overview");

  // Highlight the section currently in view in the sidebar.
  useEffect(() => {
    const ids = NAV.flatMap((g) => g.items.map((i) => i.id));
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <PublicNav />

      <div className="page-pad">
        {/* Header */}
        <section className="docs-hero">
          <div className="wrap">
            <span className="pill">Documentation</span>
            <h1>How HitPlayTogether works</h1>
            <p>
              A complete guide to the platform — for the people hosting watch
              parties and for the team managing them. Everything below is live on
              the platform today.
            </p>
          </div>
        </section>

        <div className="wrap docs-layout">
          {/* Sidebar */}
          <aside className="docs-rail">
            <nav>
              {NAV.map((g) => (
                <div className="docs-rail-group" key={g.group}>
                  <div className="docs-rail-title">{g.group}</div>
                  {g.items.map((it) => (
                    <a
                      key={it.id}
                      href={`#${it.id}`}
                      className={active === it.id ? "on" : ""}
                    >
                      {it.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="docs-body">
            <Doc id="overview" title="What is HitPlayTogether">
              <p>
                HitPlayTogether is a watch party platform. It lets people watch
                the same video together in real time, see each other on camera,
                and chat live, no matter where they are in the world.
              </p>
              <p>
                One person creates a room and pastes a video link. Everyone who
                joins watches the same video, perfectly in sync, while talking
                over live video and text chat. It is built for movie nights,
                study groups, long distance hangouts, and team get togethers.
              </p>
              <div className="docs-cards">
                <Feature title="Watch in sync" body="Everyone sees the same moment of the video at the same time, down to the second." />
                <Feature title="See each other" body="Live camera tiles let the whole room react together as it happens." />
                <Feature title="Chat live" body="A built in text chat runs alongside the video the whole time." />
              </div>
            </Doc>

            <Doc id="start" title="Create your account">
              <p>
                Getting started takes under a minute. There is nothing to
                download and no setup.
              </p>
              <Steps
                items={[
                  ["Sign up", "Open the site and choose Sign up. Enter your email and a password."],
                  ["Log in", "Use the same email and password any time to come back."],
                  ["You're in", "You land on your dashboard, ready to create or join a room."],
                ]}
              />
              <Callout>
                Your account keeps track of the rooms you have hosted and joined,
                so you can always find your way back.
              </Callout>
            </Doc>

            <Doc id="concepts" title="Key concepts">
              <Defs
                items={[
                  ["Room", "A private space where a group watches a video together. The person who creates it is the host."],
                  ["Host", "The room creator. The host controls the room, approves who can join, and can share their screen."],
                  ["Guest", "Anyone who joins a room the host has created."],
                  ["Dashboard", "Your personal home screen showing your recent and active rooms."],
                  ["Admin", "A platform manager with access to the admin dashboard that oversees all users and rooms."],
                ]}
              />
            </Doc>

            <Doc id="create" title="Creating a room">
              <p>
                From your dashboard, choose <b>New room</b>. Give the room a name,
                paste a YouTube video link, and create it. You become the host
                straight away and the video is ready to play.
              </p>
              <Callout>
                If a link is not a valid YouTube address, the platform shows a
                friendly message instead of a confusing error, so it is easy to
                fix and try again.
              </Callout>
            </Doc>

            <Doc id="invite" title="Inviting people">
              <p>
                Every room has a shareable link and a short room code. Send the
                link to friends, or share the code for them to type in. Anyone
                with it can request to join.
              </p>
            </Doc>

            <Doc id="join" title="Joining & approval">
              <p>
                When someone opens a room link or enters a code, they ask to
                join. The host receives the request and can <b>Accept</b> or{" "}
                <b>Decline</b> it. While they wait, guests see a friendly
                "waiting to be let in" screen.
              </p>
              <p>
                This keeps rooms private — only people the host approves can get
                in and start watching.
              </p>
            </Doc>

            <Doc id="sync" title="Synced video">
              <p>
                This is the heart of the platform. Everyone in the room watches
                the same video at the same point. When the host plays, pauses, or
                skips, it stays in sync for the whole room automatically, so no
                one falls behind.
              </p>
            </Doc>

            <Doc id="video-chat" title="Live video & chat">
              <p>
                Inside a room, people see each other through live camera tiles,
                like a video call, in a strip alongside the main video. A live
                text chat runs the whole time so the room can talk while they
                watch. You can enlarge a person's video tile and shrink it back
                without it freezing.
              </p>
            </Doc>

            <Doc id="screen-share" title="Host screen sharing">
              <p>
                The host can share their own screen onto the big main player so
                everyone in the room sees it. This means a host can play
                something on their computer and present it to the whole room. The
                shared screen also includes its sound, so everyone hears it too.
              </p>
              <p>
                When the host stops presenting, the room returns to the normal
                synced video.
              </p>
            </Doc>

            <Doc id="rooms" title="Managing your rooms">
              <p>
                Your dashboard and the "My rooms" area show your recent and
                active rooms so you can jump back in quickly. Rooms that have
                finished are clearly marked with an <b>ENDED</b> tag and can no
                longer be reopened by mistake.
              </p>
            </Doc>

            <Doc id="admin-overview" title="Admin: overview & analytics">
              <p>
                The admin dashboard is the control center for the whole platform.
                The overview gives a live picture of how the platform is being
                used.
              </p>
              <div className="docs-cards">
                <Feature title="Live activity" body="See how many people are online right now and how many are in live rooms." />
                <Feature title="Growth" body="Track new sign ups and how the user base is changing over time." />
                <Feature title="Top hosts & charts" body="See the most active hosts and visual charts of activity and chat engagement." />
              </div>
            </Doc>

            <Doc id="admin-users" title="Admin: managing users">
              <p>
                Admins can browse every account and open any user to see their
                full details — the rooms they have hosted, rooms they have
                joined, and how active they are.
              </p>
              <Defs
                items={[
                  ["Roles", "Promote a user to admin or remove admin access."],
                  ["Plans", "Change which plan a user is on."],
                  ["Moderation", "Ban, un-ban, or delete an account when needed."],
                  ["Browsing", "Search by name or email and page through the list 20 at a time."],
                ]}
              />
            </Doc>

            <Doc id="admin-rooms" title="Admin: managing rooms">
              <p>
                Admins can open any room to see its full information: who joined,
                the chat history, when it started and ended, how long it ran, and
                which video was used.
              </p>
              <Defs
                items={[
                  ["In-room moderation", "Mute or remove people, and delete individual chat messages."],
                  ["Ban from a room", "Ban a participant directly from the room view."],
                  ["Delete a room", "Permanently delete a room so it no longer appears anywhere."],
                  ["Browsing", "Search and page through rooms 20 at a time."],
                ]}
              />
            </Doc>

            <Doc id="admin-content" title="Admin: editing site content">
              <p>
                The content manager (CMS) lets admins edit the text and images
                shown on the public website — the headline, features, steps, use
                cases, testimonials, FAQ, and footer — without touching any code.
                It is laid out in a clean two panel view so each section is easy
                to find and update.
              </p>
            </Doc>

            <Doc id="admin-settings" title="Admin: platform settings">
              <p>
                Settings give admins a dedicated place to control platform wide
                options, such as the maximum number of people allowed in a single
                room.
              </p>
            </Doc>

            <Doc id="faq" title="Frequently asked questions">
              <Faq
                items={[
                  ["Do I need to install anything?", "No. HitPlayTogether runs in your web browser. There is nothing to download."],
                  ["What videos can I watch?", "Rooms play YouTube videos by link. Hosts can also share their own screen for anything else."],
                  ["Is my room private?", "Yes. Only people the host approves can join, and finished rooms are closed."],
                  ["Can I watch on my phone?", "Yes, the platform works on both desktop and mobile."],
                  ["Who can manage the platform?", "Admins have access to the admin dashboard, where they manage users, rooms, content, and settings."],
                ]}
              />
            </Doc>

            <div className="docs-cta">
              <h2>Ready to press play together?</h2>
              <p>Create your first watch room in under a minute.</p>
              <Link href="/signup" className="btn btn-primary">
                Create a watch room
              </Link>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </>
  );
}

/* ---------- small presentational helpers ---------- */

function Doc({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="docs-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="docs-feat">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <div className="docs-steps">
      {items.map(([t, b], i) => (
        <div className="docs-step" key={i}>
          <span className="n">{i + 1}</span>
          <div>
            <div className="t">{t}</div>
            <div className="b">{b}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Defs({ items }: { items: [string, string][] }) {
  return (
    <dl className="docs-defs">
      {items.map(([t, b], i) => (
        <div className="docs-def" key={i}>
          <dt>{t}</dt>
          <dd>{b}</dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="docs-callout">{children}</div>;
}

function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="docs-faq">
      {items.map(([q, a], i) => (
        <div className="docs-faq-item" key={i}>
          <div className="q">{q}</div>
          <div className="a">{a}</div>
        </div>
      ))}
    </div>
  );
}
