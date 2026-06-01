import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";

async function logAction(
  ctx: any,
  adminId: Id<"appUsers">,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: unknown,
) {
  await ctx.db.insert("adminActions", { adminId, action, targetType, targetId, metadata });
}

// =============== users ===============

export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("banned"), v.literal("deleted"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { search, status, limit }) => {
    await requireAdmin(ctx);
    let q: any = ctx.db.query("appUsers");
    if (status) q = q.withIndex("by_status", (i: any) => i.eq("status", status));
    const rows = await q.order("desc").take(limit ?? 100);
    const s = (search ?? "").trim().toLowerCase();
    const filtered = s
      ? rows.filter(
          (r: Doc<"appUsers">) =>
            r.displayName.toLowerCase().includes(s) || r.email.toLowerCase().includes(s),
        )
      : rows;
    return filtered;
  },
});

export const getUser = query({
  args: { userId: v.id("appUsers") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const hosted = await ctx.db
      .query("rooms")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .order("desc")
      .take(20);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_target_user", (q) => q.eq("targetUserId", userId))
      .take(20);
    const plan = await ctx.db.get(user.planId);
    const allMsgs = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const joined = await ctx.db
      .query("roomParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      user,
      rooms: hosted,
      reports,
      planName: plan?.name ?? "—",
      messageCount: allMsgs.filter((m) => !m.deletedAt).length,
      roomsJoined: joined.length,
    };
  },
});

export const banUser = mutation({
  args: { userId: v.id("appUsers") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(userId, { status: "banned" });
    await logAction(ctx, admin._id, "ban_user", "user", userId);
  },
});

export const unbanUser = mutation({
  args: { userId: v.id("appUsers") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(userId, { status: "active" });
    await logAction(ctx, admin._id, "unban_user", "user", userId);
  },
});

export const deleteUser = mutation({
  args: { userId: v.id("appUsers") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return;
    await ctx.db.patch(userId, {
      status: "deleted",
      email: `deleted-${userId}@hitplaytogether.local`,
      displayName: "Deleted user",
      avatarUrl: undefined,
    });
    await logAction(ctx, admin._id, "delete_user", "user", userId);
  },
});

// =============== rooms ===============

export const listRooms = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("ended"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    await requireAdmin(ctx);
    let q: any = ctx.db.query("rooms");
    if (status) q = q.withIndex("by_status", (i: any) => i.eq("status", status));
    const rows = await q.order("desc").take(limit ?? 100);
    return await Promise.all(
      rows.map(async (r) => {
        const host = await ctx.db.get(r.hostId);
        const ps = await ctx.db
          .query("roomParticipants")
          .withIndex("by_room", (i) => i.eq("roomId", r._id))
          .collect();
        return {
          ...r,
          hostName: host?.displayName ?? "Unknown",
          hostEmail: host?.email ?? "",
          participantCount: ps.filter((p) => !p.leftAt).length,
        };
      }),
    );
  },
});

export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireAdmin(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const host = await ctx.db.get(room.hostId);
    const ps = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const participants = await Promise.all(
      ps.map(async (p) => {
        const u = await ctx.db.get(p.userId);
        return { ...p, displayName: u?.displayName, email: u?.email };
      }),
    );
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(200);
    const messages = await Promise.all(
      msgs.reverse().map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return { ...m, authorName: u?.displayName };
      }),
    );
    return { room, host, participants, messages };
  },
});

export const endRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(roomId, { status: "ended", endedAt: Date.now() });
    await logAction(ctx, admin._id, "end_room", "room", roomId);
  },
});

// ---- in-room moderation (admin overrides the host) ----

async function findParticipant(ctx: any, roomId: Id<"rooms">, userId: Id<"appUsers">) {
  return await ctx.db
    .query("roomParticipants")
    .withIndex("by_room_user", (q: any) => q.eq("roomId", roomId).eq("userId", userId))
    .first();
}

export const muteInRoom = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("appUsers"), muted: v.boolean() },
  handler: async (ctx, { roomId, userId, muted }) => {
    const admin = await requireAdmin(ctx);
    const p = await findParticipant(ctx, roomId, userId);
    if (!p) throw new Error("That user isn't in this room.");
    await ctx.db.patch(p._id, { mutedByHost: muted });
    await logAction(ctx, admin._id, muted ? "mute_in_room" : "unmute_in_room", "room", roomId, { userId });
  },
});

export const kickFromRoom = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("appUsers") },
  handler: async (ctx, { roomId, userId }) => {
    const admin = await requireAdmin(ctx);
    const p = await findParticipant(ctx, roomId, userId);
    if (!p) throw new Error("That user isn't in this room.");
    await ctx.db.patch(p._id, { kickedAt: Date.now(), leftAt: Date.now() });
    await logAction(ctx, admin._id, "kick_from_room", "room", roomId, { userId });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(messageId, { deletedAt: Date.now() });
    await logAction(ctx, admin._id, "delete_message", "message", messageId);
  },
});

// =============== reports ===============

export const listReports = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("investigating"),
        v.literal("resolved"),
        v.literal("dismissed"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    await requireAdmin(ctx);
    let q: any = ctx.db.query("reports");
    if (status) q = q.withIndex("by_status", (i: any) => i.eq("status", status));
    const rows = await q.order("desc").take(limit ?? 100);
    return await Promise.all(
      rows.map(async (r) => {
        const reporter = await ctx.db.get(r.reporterId);
        const target = r.targetUserId ? await ctx.db.get(r.targetUserId) : null;
        return {
          ...r,
          reporterName: reporter?.displayName ?? "Unknown",
          targetName: target?.displayName ?? null,
        };
      }),
    );
  },
});

export const updateReport = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(
      v.literal("open"),
      v.literal("investigating"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
  },
  handler: async (ctx, { reportId, status }) => {
    const admin = await requireAdmin(ctx);
    const patch: Record<string, unknown> = { status };
    if (status === "resolved" || status === "dismissed") {
      patch.resolvedBy = admin._id;
      patch.resolvedAt = Date.now();
    }
    await ctx.db.patch(reportId, patch);
    await logAction(ctx, admin._id, "update_report", "report", reportId, { status });
  },
});

// =============== audit log ===============

export const auditLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("adminActions").order("desc").take(limit ?? 100);
    return await Promise.all(
      rows.map(async (r) => {
        const admin = await ctx.db.get(r.adminId);
        return { ...r, adminName: admin?.displayName ?? "Unknown" };
      }),
    );
  },
});

// =============== analytics ===============

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const dayAgo = now - 24 * 3600_000;
    const week = 7 * 24 * 3600_000;
    const liveWindow = now - 60_000; // presence heartbeat freshness

    const users = await ctx.db.query("appUsers").collect();
    const activeRooms = await ctx.db
      .query("rooms")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const allRooms = await ctx.db.query("rooms").collect();
    const messages = await ctx.db.query("messages").collect();
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const presence = await ctx.db.query("presence").collect();

    const live = presence.filter(
      (p) => p.state !== "offline" && p.heartbeatAt >= liveWindow,
    );
    const onlineNow = new Set(live.map((p) => String(p.userId))).size;

    // active participants currently sitting in a live room
    const activeRoomIds = new Set(activeRooms.map((r) => String(r._id)));
    const liveParticipants = live.filter((p) =>
      activeRoomIds.has(String(p.roomId)),
    ).length;

    // 7-day signups vs the prior 7 days → growth delta
    const newUsers7d = users.filter((u) => u._creationTime >= now - week).length;
    const prevUsers7d = users.filter(
      (u) => u._creationTime >= now - 2 * week && u._creationTime < now - week,
    ).length;

    return {
      totalUsers: users.filter((u) => u.status !== "deleted").length,
      bannedUsers: users.filter((u) => u.status === "banned").length,
      adminUsers: users.filter((u) => u.isAdmin && u.status !== "deleted").length,
      activeRooms: activeRooms.length,
      totalRooms: allRooms.length,
      roomsToday: allRooms.filter((r) => r._creationTime >= dayAgo).length,
      totalMessages: messages.filter((m) => !m.deletedAt).length,
      messagesToday: messages.filter((m) => m._creationTime >= dayAgo).length,
      openReports: reports.length,
      onlineNow,
      liveParticipants,
      newUsers7d,
      prevUsers7d,
    };
  },
});

// =============== admin role & plan management (in-UI) ===============

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("plans").collect();
  },
});

export const setUserAdmin = mutation({
  args: { userId: v.id("appUsers"), isAdmin: v.boolean() },
  handler: async (ctx, { userId, isAdmin }) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found");
    if (!isAdmin) {
      // Guard: never let an admin demote themselves, and never remove the
      // last remaining admin (which would lock everyone out of the panel).
      if (String(userId) === String(admin._id)) {
        throw new Error("You can't remove your own admin access.");
      }
      const admins = await ctx.db
        .query("appUsers")
        .withIndex("by_isAdmin", (q) => q.eq("isAdmin", true))
        .collect();
      const activeAdmins = admins.filter((a) => a.status !== "deleted");
      if (activeAdmins.length <= 1) {
        throw new Error("Can't demote the last admin.");
      }
    }
    await ctx.db.patch(userId, { isAdmin });
    await logAction(ctx, admin._id, isAdmin ? "grant_admin" : "revoke_admin", "user", userId);
  },
});

export const setUserPlan = mutation({
  args: { userId: v.id("appUsers"), planId: v.id("plans") },
  handler: async (ctx, { userId, planId }) => {
    const admin = await requireAdmin(ctx);
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");
    await ctx.db.patch(userId, { planId });
    await logAction(ctx, admin._id, "change_plan", "user", userId, { plan: plan.name });
  },
});

// messages per day — engagement trend for Analytics
export const messagesActivity = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const n = days ?? 14;
    const cutoff = Date.now() - n * 24 * 3600_000;
    const messages = await ctx.db.query("messages").collect();
    const buckets: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const k = dayKey(Date.now() - i * 24 * 3600_000);
      buckets[k] = 0;
    }
    for (const m of messages) {
      if (m._creationTime < cutoff || m.deletedAt) continue;
      const k = dayKey(m._creationTime);
      if (k in buckets) buckets[k]++;
    }
    return Object.entries(buckets)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const signups = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const n = days ?? 14;
    const cutoff = Date.now() - n * 24 * 3600_000;
    const users = await ctx.db.query("appUsers").collect();
    const buckets: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const k = dayKey(Date.now() - i * 24 * 3600_000);
      buckets[k] = 0;
    }
    for (const u of users) {
      if (u._creationTime < cutoff) continue;
      const k = dayKey(u._creationTime);
      if (k in buckets) buckets[k]++;
    }
    return Object.entries(buckets)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const roomsActivity = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const n = days ?? 14;
    const cutoff = Date.now() - n * 24 * 3600_000;
    const rooms = await ctx.db.query("rooms").collect();
    const buckets: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const k = dayKey(Date.now() - i * 24 * 3600_000);
      buckets[k] = 0;
    }
    for (const r of rooms) {
      if (r._creationTime < cutoff) continue;
      const k = dayKey(r._creationTime);
      if (k in buckets) buckets[k]++;
    }
    return Object.entries(buckets)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const topHosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAdmin(ctx);
    const rooms = await ctx.db.query("rooms").collect();
    const tally = new Map<string, number>();
    for (const r of rooms) tally.set(r.hostId, (tally.get(r.hostId) ?? 0) + 1);
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit ?? 10);
    return await Promise.all(
      ranked.map(async ([userId, count]) => {
        const u = await ctx.db.get(userId as Id<"appUsers">);
        return { userId, count, displayName: u?.displayName ?? "Unknown", email: u?.email ?? "" };
      }),
    );
  },
});
