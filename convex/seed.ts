import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { generateRoomCode } from "./lib/code";
import { extractYouTubeId } from "./lib/youtube";

/**
 * Idempotent seed. Wipes the dev data we own (NOT the auth tables) and
 * reinserts: plans, users, rooms, messages, reports, all CMS content.
 *
 * Usage from the Convex dashboard or CLI:
 *   npx convex run seed:run
 *
 * `seed:runIfEmpty` only seeds when the database is fresh — safe for CI.
 */
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    await wipe(ctx);
    return await doSeed(ctx);
  },
});

export const runIfEmpty = internalMutation({
  args: {},
  handler: async (ctx) => {
    const anyPlan = await ctx.db.query("plans").first();
    if (anyPlan) return { skipped: true };
    return await doSeed(ctx);
  },
});

async function wipe(ctx: any) {
  const tables = [
    "messages",
    "presence",
    "roomParticipants",
    "rooms",
    "reports",
    "adminActions",
    "contentBlocks",
    "siteContent",
    "appUsers",
    "plans",
  ] as const;
  for (const t of tables) {
    const rows = await ctx.db.query(t).collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
}

async function doSeed(ctx: any) {
  // ---------- plans ----------
  const freePlanId = await ctx.db.insert("plans", {
    name: "Free",
    slug: "free",
    priceCents: 0,
    isDefault: true,
  });

  // ---------- users ----------
  const adminId = await ctx.db.insert("appUsers", {
    displayName: "Admin",
    email: "admin@hitplaytogether.local",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    status: "active",
    isAdmin: true,
    planId: freePlanId,
  });

  const christinaId = await ctx.db.insert("appUsers", {
    displayName: "Christina Jenkins",
    email: "christina@hitplaytogether.local",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    status: "active",
    isAdmin: false,
    planId: freePlanId,
  });

  const marcusId = await ctx.db.insert("appUsers", {
    displayName: "Marcus T.",
    email: "marcus@hitplaytogether.local",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    status: "active",
    isAdmin: false,
    planId: freePlanId,
  });

  const priyaId = await ctx.db.insert("appUsers", {
    displayName: "Priya S.",
    email: "priya@hitplaytogether.local",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    status: "active",
    isAdmin: false,
    planId: freePlanId,
  });

  const devonId = await ctx.db.insert("appUsers", {
    displayName: "Devon K.",
    email: "devon@hitplaytogether.local",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    status: "active",
    isAdmin: false,
    planId: freePlanId,
  });

  // ---------- rooms ----------
  const roomSeeds = [
    {
      name: "Friday Movie Night",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      title: "Big Buck Bunny",
      hostId: christinaId,
      participants: [marcusId, priyaId, devonId],
    },
    {
      name: "Anime Marathon",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Opening Sequence",
      hostId: marcusId,
      participants: [christinaId, priyaId],
    },
    {
      name: "Study Session 🎧",
      url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      title: "Focus mix",
      hostId: priyaId,
      participants: [christinaId, devonId],
    },
  ];

  const createdRoomIds: Id<"rooms">[] = [];
  for (const r of roomSeeds) {
    const videoId = extractYouTubeId(r.url)!;
    const roomId = await ctx.db.insert("rooms", {
      name: r.name,
      code: generateRoomCode(),
      privacy: "private",
      hostId: r.hostId,
      videoProvider: "youtube",
      videoUrl: r.url,
      videoId,
      videoTitle: r.title,
      status: "active",
      playbackState: "paused",
      playbackPositionMs: 0,
      playbackUpdatedAt: Date.now(),
    });
    createdRoomIds.push(roomId);
    await ctx.db.insert("roomParticipants", {
      roomId,
      userId: r.hostId,
      role: "host",
      joinedAt: Date.now(),
    });
    for (const p of r.participants) {
      await ctx.db.insert("roomParticipants", {
        roomId,
        userId: p,
        role: "participant",
        joinedAt: Date.now(),
      });
    }
  }

  // ---------- messages ----------
  const chatLines = [
    [marcusId, "this scene is unreal 😭"],
    [christinaId, "told you!! pause it i need a snack"],
    [devonId, "go go we'll wait"],
    [priyaId, "hurry up the best part is coming 👀"],
  ] as const;
  for (const [userId, body] of chatLines) {
    await ctx.db.insert("messages", {
      roomId: createdRoomIds[0],
      userId,
      body,
    });
  }

  // ---------- reports ----------
  await ctx.db.insert("reports", {
    reporterId: priyaId,
    targetType: "message",
    targetUserId: marcusId,
    reason: "spam",
    details: "Repeated unrelated links in chat.",
    status: "open",
  });
  await ctx.db.insert("reports", {
    reporterId: devonId,
    targetType: "user",
    targetUserId: marcusId,
    reason: "harassment",
    status: "investigating",
  });

  // ---------- siteContent (single editable fields) ----------
  const settings = [
    // hero
    { key: "hero.pill", section: "hero", label: "Hero pill", type: "text", value: "Watch together, in sync" },
    { key: "hero.headline1", section: "hero", label: "Hero headline (line 1)", type: "text", value: "Press play." },
    { key: "hero.headline2", section: "hero", label: "Hero headline (line 2, gradient)", type: "text", value: "Together." },
    { key: "hero.subhead", section: "hero", label: "Hero subhead", type: "longtext",
      value: "Create private watch rooms, sync your video to the millisecond, and react in real time with live chat — no matter where your friends are." },
    { key: "hero.ctaPrimary", section: "hero", label: "Hero primary CTA", type: "text", value: "Create a watch room" },
    { key: "hero.ctaSecondary", section: "hero", label: "Hero secondary CTA", type: "text", value: "See how it works" },
    { key: "hero.image", section: "hero", label: "Hero image URL", type: "imageUrl",
      value: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&q=80" },
    { key: "hero.stat1.n", section: "hero", label: "Hero stat 1 number", type: "text", value: "<100ms" },
    { key: "hero.stat1.l", section: "hero", label: "Hero stat 1 label", type: "text", value: "Sync precision" },
    { key: "hero.stat2.n", section: "hero", label: "Hero stat 2 number", type: "text", value: "∞" },
    { key: "hero.stat2.l", section: "hero", label: "Hero stat 2 label", type: "text", value: "Rooms you can host" },
    { key: "hero.stat3.n", section: "hero", label: "Hero stat 3 number", type: "text", value: "Live" },
    { key: "hero.stat3.l", section: "hero", label: "Hero stat 3 label", type: "text", value: "Chat & presence" },

    // section headings
    { key: "features.pill", section: "features", label: "Features pill", type: "text", value: "Features" },
    { key: "features.heading", section: "features", label: "Features heading", type: "text", value: "Everything you need to watch as one" },
    { key: "features.sub", section: "features", label: "Features subhead", type: "text", value: "Built for movie nights, study groups, and long-distance hangouts." },

    { key: "steps.pill", section: "steps", label: "Steps pill", type: "text", value: "How it works" },
    { key: "steps.heading", section: "steps", label: "Steps heading", type: "text", value: "Three steps to your first watch party" },
    { key: "steps.sub", section: "steps", label: "Steps subhead", type: "text", value: "No downloads. No setup. Just press play." },

    { key: "usecases.pill", section: "usecases", label: "Use-cases pill", type: "text", value: "Made for every hangout" },
    { key: "usecases.heading", section: "usecases", label: "Use-cases heading", type: "text", value: "One platform, endless watch parties" },

    { key: "testimonials.pill", section: "testimonials", label: "Testimonials pill", type: "text", value: "Loved by watch parties" },
    { key: "testimonials.heading", section: "testimonials", label: "Testimonials heading", type: "text", value: "What early users are saying" },

    { key: "faq.heading", section: "faq", label: "FAQ heading", type: "text", value: "Frequently asked questions" },

    // band stats
    { key: "band.s1.n", section: "band", label: "Band stat 1 number", type: "text", value: "<100ms" },
    { key: "band.s1.l", section: "band", label: "Band stat 1 label", type: "text", value: "Sync precision" },
    { key: "band.s2.n", section: "band", label: "Band stat 2 number", type: "text", value: "∞" },
    { key: "band.s2.l", section: "band", label: "Band stat 2 label", type: "text", value: "Rooms you can host" },
    { key: "band.s3.n", section: "band", label: "Band stat 3 number", type: "text", value: "100%" },
    { key: "band.s3.l", section: "band", label: "Band stat 3 label", type: "text", value: "Browser-based, no app" },
    { key: "band.s4.n", section: "band", label: "Band stat 4 number", type: "text", value: "24/7" },
    { key: "band.s4.l", section: "band", label: "Band stat 4 label", type: "text", value: "Watch anytime" },

    // final cta
    { key: "cta.heading", section: "cta", label: "Final CTA heading", type: "text", value: "Ready to press play together?" },
    { key: "cta.sub", section: "cta", label: "Final CTA subhead", type: "text", value: "Create your first watch room in under a minute." },
    { key: "cta.button", section: "cta", label: "Final CTA button", type: "text", value: "Create a watch room" },

    // footer
    { key: "footer.tagline", section: "footer", label: "Footer tagline", type: "text",
      value: "Watch together, in sync — wherever your friends are." },
    { key: "footer.copyright", section: "footer", label: "Footer copyright", type: "text",
      value: "© 2026 HitPlayTogether.com — All rights reserved." },
  ] as const;
  for (const s of settings) {
    await ctx.db.insert("siteContent", { ...s });
  }

  // ---------- contentBlocks ----------
  const features = [
    {
      icon: "⏯",
      iconColor: "a",
      title: "Synced playback",
      body: "Play, pause and seek once — every participant's player updates instantly through our real-time sync engine.",
      imageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&q=80",
    },
    {
      icon: "🔒",
      iconColor: "b",
      title: "Private watch rooms",
      body: "Spin up an invite-only room in seconds. Share a link or a 6-character code and you're in.",
      imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80",
    },
    {
      icon: "💬",
      iconColor: "c",
      title: "Live chat & presence",
      body: "React in the moment with text chat, and see who's online, typing, or active right beside the video.",
      imageUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&q=80",
    },
  ];
  for (let i = 0; i < features.length; i++) {
    await ctx.db.insert("contentBlocks", {
      section: "features",
      order: i,
      visible: true,
      data: features[i],
    });
  }

  const steps = [
    { number: 1, title: "Create a room",
      body: "Name your room, choose private or invite-link access, and paste a YouTube video URL." },
    { number: 2, title: "Invite your friends",
      body: "Share the room link or 6-character code. Friends join instantly from any browser." },
    { number: 3, title: "Watch in sync",
      body: "Everyone's player stays locked together. Chat, react and enjoy — all in real time." },
  ];
  for (let i = 0; i < steps.length; i++) {
    await ctx.db.insert("contentBlocks", { section: "steps", order: i, visible: true, data: steps[i] });
  }

  const usecases = [
    { emoji: "🍿", title: "Movie nights",
      body: "Gather friends for a film even when you're miles apart.",
      imageUrl: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=500&q=80" },
    { emoji: "📺", title: "Binge sessions",
      body: "Marathon a whole series together, episode after episode.",
      imageUrl: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=500&q=80" },
    { emoji: "🎓", title: "Study groups",
      body: "Watch lectures and tutorials side by side with classmates.",
      imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&q=80" },
    { emoji: "🎮", title: "Reaction rooms",
      body: "Catch trailers, music videos and esports with your crew.",
      imageUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=500&q=80" },
  ];
  for (let i = 0; i < usecases.length; i++) {
    await ctx.db.insert("contentBlocks", { section: "usecases", order: i, visible: true, data: usecases[i] });
  }

  const testimonials = [
    { quote: "Movie night with my long-distance friends finally feels normal again. The sync just works.",
      name: "Aisha R.", role: "Watch party host", stars: 5,
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80" },
    { quote: "We binge-watch tutorials as a study group. Setting up a room takes about ten seconds.",
      name: "Marcus T.", role: "Study group lead", stars: 5,
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80" },
    { quote: "The live chat next to the video makes it feel like we're all on the same couch.",
      name: "Priya S.", role: "Regular user", stars: 5,
      avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80" },
  ];
  for (let i = 0; i < testimonials.length; i++) {
    await ctx.db.insert("contentBlocks", { section: "testimonials", order: i, visible: true, data: testimonials[i] });
  }

  const faq = [
    { question: "Is HitPlayTogether free to use?",
      answer: "Yes — creating an account and hosting watch rooms is free." },
    { question: "What videos can I watch together?",
      answer: "You can play YouTube videos by pasting the video URL into your room." },
    { question: "Do my friends need to download anything?",
      answer: "No. HitPlayTogether runs entirely in the browser on desktop, tablet and mobile — just share the room link." },
    { question: "How many people can join one room?",
      answer: "Rooms are designed for friend-group watch parties, with live chat and presence for every participant." },
  ];
  for (let i = 0; i < faq.length; i++) {
    await ctx.db.insert("contentBlocks", { section: "faq", order: i, visible: true, data: faq[i] });
  }

  return {
    ok: true,
    plans: 1,
    users: 5,
    rooms: createdRoomIds.length,
    messages: chatLines.length,
    settings: settings.length,
    blocks: features.length + steps.length + usecases.length + testimonials.length + faq.length,
  };
}
