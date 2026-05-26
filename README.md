# HitPlayTogether

Social streaming & watch-party platform.

**Stack:** TypeScript · Next.js 14 (App Router) · Convex · LiveKit · YouTube IFrame Player

This repo is built phase-by-phase against `HitPlayTogether-Build-Spec-v2.docx` (parent folder).

---

## What's here

- **Convex backend** — `convex/`: schema (10 tables), auth, rooms, messages, presence, video token action, admin, CMS, seed.
- **User app** — `app/`: 8 dynamic pages (landing, signup, login, dashboard, create-room, join-room, watch-room, profile).
- **Watch room** — synchronized YouTube playback, live text chat, presence, and a LiveKit video-chat strip beneath the player.
- **Admin dashboard** — `app/admin/`: 7 pages (login, overview, users, rooms, analytics, reports, content manager).
- **CMS** — the entire landing page renders from `siteContent` + `contentBlocks`. Admin edits → live site updates instantly.

---

## First-time setup

```bash
cd hitplaytogether
npm install
```

### 1. Convex deployment

```bash
npx convex dev
```

Follow the prompts. This writes `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` to `.env.local`.

### 2. Convex Auth keys

```bash
npx @convex-dev/auth
```

This adds `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` to your Convex deployment.

### 3. LiveKit (video chat)

Create a free project at [livekit.io](https://cloud.livekit.io), then set secrets on the Convex deployment:

```bash
npx convex env set LIVEKIT_API_KEY <your-key>
npx convex env set LIVEKIT_API_SECRET <your-secret>
npx convex env set LIVEKIT_URL wss://<your-project>.livekit.cloud
```

And in `.env.local` for the browser side:

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://<your-project>.livekit.cloud
```

### 4. Seed the database

```bash
npx convex run seed:run
```

This inserts: one Free plan, an admin user, four normal users, three rooms with messages, two reports, and all landing-page content into the CMS tables.

### 5. Create real auth accounts for the seed users

The seed inserts the *application-side* `users` rows, but Convex Auth's `authAccounts`/`authSessions` are separate. To log in as the seeded admin or any seeded user, **register them via the UI** with the matching email — the `users.bootstrap` mutation links the auth identity to the existing app-side row by email.

Seeded emails (use any password ≥ 8 chars when registering):

- `admin@hitplaytogether.local` — admin
- `christina@hitplaytogether.local`
- `marcus@hitplaytogether.local`
- `priya@hitplaytogether.local`
- `devon@hitplaytogether.local`

> If you sign up with a brand-new email instead, the bootstrap mutation creates a fresh app-side row with `isAdmin: false` on the Free plan.

### 6. Run the app

```bash
npm run dev
```

- User app: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>

---

## Conventions

- **TypeScript everywhere** — both front-end and Convex functions.
- **All real-time** — chat, presence, playback sync — uses Convex reactive queries. No polling, no separate socket server.
- **Only YouTube** for watch content. URL parsing lives in `convex/lib/youtube.ts` — nowhere else.
- **Video chat is live only.** LiveKit recording is *not* enabled in `convex/video.ts`. No video or audio is ever recorded or stored.
- **Every admin mutation** writes an `adminActions` row (see `logAction` in `convex/admin.ts` and `logEdit` in `convex/content.ts`).
- **No landing-page content is hard-coded** — `app/page.tsx` renders from `content.getPublic`. Edit it in the admin Content Manager and the live site updates immediately.

---

## Future-proofing (per spec §1.3)

- `plans` table + `users.planId` ready for paid tiers.
- `convex/lib/entitlements.ts` is the single 'what can this user do' surface.
- Convex's mobile clients can reuse every backend function without changes.
- `convex/lib/youtube.ts` is the only YouTube parser — adding a new source later means extending this one file plus the `videoProvider` union on `rooms`.

---

## Tests

```bash
npm test
```

Covers the YouTube URL parser and room-code generator. Authentication, room creation, and message sending are exercised end-to-end through the dev UI.

---

## Project layout

```
hitplaytogether/
├─ convex/                 # Convex backend (TypeScript)
│  ├─ schema.ts            # 10 tables
│  ├─ auth.ts http.ts      # Convex Auth wiring
│  ├─ users.ts rooms.ts
│  ├─ messages.ts presence.ts
│  ├─ video.ts             # LiveKit token action (Node runtime)
│  ├─ admin.ts content.ts
│  ├─ seed.ts              # idempotent seed mutation
│  └─ lib/                 # auth helpers, youtube parser, entitlements, code gen
├─ app/                    # Next.js App Router
│  ├─ page.tsx             # CMS-driven landing
│  ├─ signup/ login/
│  ├─ dashboard/ create-room/ join-room/
│  ├─ room/[id]/page.tsx   # watch room
│  ├─ profile/
│  └─ admin/               # admin shell + 7 admin pages
├─ components/             # Nav, Footer, YouTubePlayer, VideoChatStrip, AdminShell, AuthBootstrap
├─ tests/                  # vitest
└─ .env.local              # NEXT_PUBLIC_CONVEX_URL + NEXT_PUBLIC_LIVEKIT_URL
```
