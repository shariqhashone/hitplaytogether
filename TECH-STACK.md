# HitPlayTogether — Technology Stack

A reference for every library and service in this project: **what it does** and **why it was chosen** over the alternatives.

---

## At a glance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Language | TypeScript | End-to-end type safety (front-end + backend) |
| Front-end framework | Next.js 14 (App Router) | React with file-based routing, SSR, and Vercel-native deploys |
| UI library | React 18 | Component model + reactive rendering |
| Styling | Plain CSS (port of original `style.css`) | No build tooling overhead; matches the existing dark theme exactly |
| Backend platform | Convex | Database + server functions + real-time, all in one |
| Authentication | Convex Auth (Password provider) | Sessions managed inside Convex; no separate auth service |
| Watch content | YouTube IFrame Player API | The only video source allowed by spec |
| Live video & audio chat | LiveKit (WebRTC SDK + cloud) | Camera, mic, screen share between participants |
| Charts (admin) | Recharts | Lightweight React-native chart library |
| Hosting | Vercel | Zero-config Next.js deploys, GitHub auto-deploy on push |
| Tests | Vitest | Fast unit tests for pure helpers |

---

## Languages & build

### TypeScript
**What:** A typed superset of JavaScript. The Next.js app, all Convex functions, and shared utilities are written in TypeScript.

**Why:**
- The spec mandates "TypeScript everywhere — both front-end and Convex functions."
- Convex generates typed client APIs from your server code — calling `api.rooms.create({...})` from the browser is fully autocompleted and type-checked. Misnamed fields fail at compile time, not in production.
- Schema changes propagate: rename a column in `convex/schema.ts` and every consumer breaks until you fix it.

---

## Front-end

### Next.js 14 (App Router)
**What:** A React framework with file-based routing, server components, middleware, and built-in Vercel integration.

**Why:**
- **App Router** lets us colocate layouts, loading states, and server-only code (like the auth middleware) per route segment.
- **`middleware.ts`** runs at the edge to redirect unauthenticated users away from `/dashboard`, `/room/[id]`, `/profile`, and `/admin` — no per-page guard boilerplate.
- **Vercel deployment** is one `git push`. Vercel detects Next.js automatically.
- **Why not Vite + React Router?** Vite is leaner but we'd lose middleware, server-side auth state, and Vercel's first-party support. The spec also names Next.js explicitly.
- **Why App Router over Pages Router?** Server components, nested layouts, and the modern auth middleware pattern are App Router–only.

### React 18
**What:** UI component library. Everything visible is a React component.

**Why:** Convex's reactive queries (`useQuery`) are React hooks. Pairing them with anything else would be working against the grain. Concurrent rendering and `Suspense` also help with the loading states.

### Plain CSS (`app/globals.css`)
**What:** A single global stylesheet ported from the original `HitPlayTogether-UI/style.css`. CSS variables drive the dark theme.

**Why:**
- The static HTML mockups already had a polished design system — porting it verbatim guarantees pixel parity.
- **Why not Tailwind?** Would mean rewriting every class from the mockups, more build config, and bigger surface for visual drift.
- **Why not CSS-in-JS?** Adds runtime cost and another mental model. CSS variables + a few `.css` files keep it inspectable in DevTools.

### Fonts: Sora + Outfit (Google Fonts)
Pulled via `<link>` from Google Fonts in `app/layout.tsx`. Matches the original design.

---

## Backend

### Convex
**What:** A reactive backend platform. One service provides:
- Document database (TypeScript schemas in `convex/schema.ts`)
- Server functions: `query` (read), `mutation` (write), `action` (Node runtime for side effects like external API calls)
- HTTP routes (used by Convex Auth)
- File storage (not used here yet)
- **Real-time out of the box** — every `query` re-runs on the client when its data changes

**Why over a traditional Node/Express + PostgreSQL stack:**
- **Real-time chat, presence, and playback sync are free.** Sending a chat message just inserts a row; every browser subscribed to `messages.list` re-renders automatically. No Socket.IO server, no polling, no manual fan-out.
- **No REST layer to maintain.** The browser calls Convex functions directly via the typed client.
- **Schema, validators, indexes, and queries live next to each other** in TypeScript — easier to keep consistent than a SQL migration folder + an ORM + handwritten endpoints.
- **Hosted by default.** The dev deployment (`strong-gopher-137`) was created with one command; production is the same command with `--prod`. No Postgres to provision, no Redis for pub/sub.
- The spec mandates Convex.

**What we use inside Convex:**
- `convex/schema.ts` — 10 tables (`appUsers`, `rooms`, `roomParticipants`, `messages`, `presence`, `reports`, `adminActions`, `siteContent`, `contentBlocks`, `plans`) plus the auth tables Convex Auth contributes.
- `convex/rooms.ts`, `convex/messages.ts`, `convex/presence.ts` — the watch-party real-time layer.
- `convex/video.ts` — a Node-runtime **action** (the `"use node"` directive at the top) so we can use the LiveKit Node SDK to mint tokens. Plain queries/mutations run in V8 isolates without Node APIs.
- `convex/admin.ts`, `convex/content.ts` — admin moderation + CMS.
- `convex/seed.ts` — idempotent dev-data seed.

### Convex Auth (Password provider)
**What:** The official auth library for Convex. We use the `Password` provider — email + password, no third-party OAuth yet.

**Why:**
- Sessions, JWT keys, and the `signIn`/`signOut` client helpers are all built in.
- It owns the `users`, `authAccounts`, and `authSessions` tables. Our app-level profile lives in a separate `appUsers` table, linked by `authId`. (We learned the hard way that overriding Convex Auth's `users` table breaks sign-up.)
- **Why not Auth.js (NextAuth) or Clerk?** Both work with Next.js but neither integrates with Convex sessions natively — we'd be syncing auth state between two systems. Convex Auth keeps everything in one place.

---

## Real-time architecture

Three "live" features in the watch room — all powered by Convex queries:

| Feature | How it works |
|---------|-------------|
| **Chat** | `messages.send` mutation inserts a row → every client subscribed to `messages.list` re-renders. No Socket.IO. |
| **Presence** | Each client heartbeats every 15s via `presence.setState`. `presence.forRoom` returns who's online/typing; rows older than 30s are reported as offline. |
| **Playback sync** | The host's YouTube IFrame events (play/pause/seek) call `rooms.setPlayback`, which writes to the room row. Every non-host subscribes to `rooms.get` and reconciles their player when `playbackState` / `playbackPositionMs` changes. |

This is the spec's "no separate WebSocket server" promise — chat/presence/sync are just database reads with subscriptions.

---

## Video & audio chat

### LiveKit (`livekit-client` + `livekit-server-sdk` + LiveKit Cloud)
**What:** An open-source WebRTC SDK with a managed cloud service. Camera, microphone, and screen-share media flow peer-to-peer through LiveKit's SFU — not through Convex.

**Why LiveKit specifically:**
- Spec listed LiveKit or Daily — LiveKit's free tier is generous and the open-source server can be self-hosted if needed.
- The `livekit-client` browser SDK handles all the WebRTC plumbing: track publishing, ICE negotiation, active-speaker detection, screen capture.
- The `livekit-server-sdk` Node package signs short-lived access tokens — used inside `convex/video.ts` so the API secret never leaves the server.

**How it slots into the app:**
1. User opens a watch room → the page calls the Convex `video.getToken` action.
2. That action verifies the caller is a member of the room, then mints a LiveKit JWT scoped to that room name + identity.
3. The browser uses the token to connect with `livekit-client`'s `Room`, enables camera + mic, and subscribes to remote tracks.
4. `RoomEvent.TrackSubscribed` fires for remote audio — we attach each one to a hidden `<audio>` element so the browser actually plays sound.
5. `RoomEvent.ActiveSpeakersChanged` drives the cyan glow + pulse animation around the speaking tile.

**Why media doesn't go through Convex:** real-time text/state is cheap; live A/V is expensive bandwidth. Convex is a database, not an SFU. LiveKit's SFU is built for exactly this — 100ms-latency video with hundreds of participants.

**Recording is OFF.** Per spec, no audio or video is ever stored. We never call LiveKit's `EgressClient`.

---

## YouTube IFrame Player API
**What:** Google's official JS API for embedding a YouTube player and controlling it (`playVideo`, `pauseVideo`, `seekTo`, `getCurrentTime`).

**Why:**
- The spec mandates YouTube as the only video source.
- The IFrame API exposes player state events we use to detect the host pressing play/pause/seek → we mirror those events into `rooms.setPlayback`.

**Loaded lazily** in `components/YouTubePlayer.tsx` — only when a watch room mounts.

---

## Admin & CMS

### Recharts
**What:** A React chart library built on D3. Used in `app/admin/page.tsx` (overview line charts) and `app/admin/analytics/page.tsx` (bar charts).

**Why:**
- Lightweight (~90KB gzipped), React-native API (`<LineChart>`, `<Bar>`), styles cleanly with our dark theme via inline props.
- **Why not Chart.js?** Imperative API doesn't compose with React; we'd need a wrapper. Recharts is React-first.
- **Why not Tremor or shadcn charts?** Both bundle Tailwind/Radix; we're staying CSS-light.

### CMS architecture
Pages render entirely from two Convex tables:
- `siteContent` — single editable fields keyed by string (`hero.headline1`, `cta.button`, …)
- `contentBlocks` — repeatable items (`features`, `steps`, `usecases`, `testimonials`, `faq`) with `order` and `visible` flags

Editing in `/admin/content` writes via mutations → the landing page's `content.getPublic` query re-runs on every browser → instant update, no rebuild.

---

## Hosting & deployment

### Vercel
**What:** A hosting platform optimized for Next.js. Connected to our GitHub repo — every `git push` builds and deploys.

**Why:**
- Built by the Next.js team. Image optimization, edge middleware, environment variables — all first-class.
- Free tier is enough for staging.
- **Convex pairs cleanly:** Vercel hosts the front-end; Convex hosts its own functions/data. We just give Vercel `NEXT_PUBLIC_CONVEX_URL` and the two communicate over HTTPS/WebSockets.

### GitHub
Source of truth for the codebase + Vercel's deploy trigger. `.env.local` and `.convex/` are gitignored so no secrets leak.

---

## Testing

### Vitest
**What:** Test runner built on Vite. Fast cold start, ESM-native, Jest-compatible API.

**Why over Jest:** native ESM + TypeScript with no `ts-jest` config, much faster startup.

**What's covered:**
- `tests/youtube.test.ts` — `extractYouTubeId` parses every YouTube URL shape.
- `tests/code.test.ts` — room codes are 6 chars and avoid confusable characters (0/O/1/I/L).

Higher-level flows (sign-up, room creation, sending messages) are exercised through the dev UI rather than mocked.

---

## What we deliberately did NOT add

| Avoided | Why |
|---------|-----|
| Express / REST API | Convex functions replace this entirely. |
| Socket.IO / custom WebSocket server | Convex reactive queries handle live data. |
| Redis / pub-sub | Same reason. |
| Postgres / Prisma | Convex is the database. |
| Tailwind CSS | The mockup CSS was already done. |
| Auth.js / Clerk / Firebase Auth | Convex Auth integrates natively with Convex sessions. |
| GraphQL | Convex's typed client gives us the same DX without a schema layer. |
| State manager (Redux, Zustand) | `useQuery` + local `useState` cover every case so far. |
| Recording (LiveKit Egress) | Spec forbids storing audio/video. |
| Other video providers (Vimeo, Twitch, etc.) | Spec restricts to YouTube. |

---

## Future-proofing (per spec §1.3)

| Future feature | What's already in place |
|---|---|
| Paid plans | `plans` table + `appUsers.planId` + `convex/lib/entitlements.ts` single gating module |
| Payments | None integrated; all "what can this user do" checks go through `entitlementsFor()` so a Stripe webhook can flip a flag without scattered changes |
| Mobile app | Convex has official Swift / Kotlin clients — they call the exact same functions; no backend rewrite needed |
| More video sources | YouTube parsing is isolated to `convex/lib/youtube.ts`; the `rooms.videoProvider` union just needs new literals |

---

## File-by-file summary

```
convex/
  schema.ts              # the data model (10 app tables + Convex Auth tables)
  auth.ts http.ts        # Convex Auth (Password) wiring
  users.ts               # appUsers profile + bootstrap (links auth identity → app row)
  rooms.ts               # create/join/leave + playback sync + host moderation + screen-share approval
  messages.ts            # chat reactive queries
  presence.ts            # presence + typing
  video.ts               # LiveKit token (Node runtime action)
  admin.ts content.ts    # admin moderation + CMS
  seed.ts                # idempotent seed
  lib/
    auth.ts              # requireUser / requireAdmin helpers
    youtube.ts           # the only place YouTube URLs are parsed
    entitlements.ts      # single gating surface for plan-based limits
    code.ts              # 6-char room code generator (avoids 0/O/1/I/L)

app/
  page.tsx               # landing — renders entirely from content.getPublic
  layout.tsx             # global font/CSS + Convex providers
  signup/ login/         # Convex Auth signup / login
  dashboard/             # rooms.myRooms + join-by-code
  create-room/ join-room/
  my-rooms/              # dedicated rooms list with filters
  profile/               # users.updateProfile
  room/[id]/             # the watch room — YT player + Convex realtime + LiveKit strip + emoji animation
  admin/                 # 7-page admin dashboard

components/
  Nav.tsx                # public + app navs (auth-aware)
  Footer.tsx
  AuthBootstrap.tsx      # creates the appUsers row on first sign-in
  YouTubePlayer.tsx      # IFrame API wrapper
  VideoChatStrip.tsx     # LiveKit camera/mic/screen + active-speaker glow + tile pin
  EmojiPicker.tsx        # in-chat emoji picker + emoji-only detection
  AdminShell.tsx         # admin sidebar + topbar + auth gate
```
