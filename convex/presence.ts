import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { resolveAvatar } from "./lib/avatar";

const STALE_MS = 30_000; // anyone who hasn't heartbeat in 30s is "offline"

export const setState = mutation({
  args: {
    roomId: v.id("rooms"),
    state: v.union(v.literal("online"), v.literal("typing"), v.literal("offline")),
  },
  handler: async (ctx, { roomId, state }) => {
    const me = await requireUser(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", me._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { state, heartbeatAt: Date.now() });
    } else {
      await ctx.db.insert("presence", { roomId, userId: me._id, state, heartbeatAt: Date.now() });
    }
  },
});

export const forRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const now = Date.now();
    return await Promise.all(
      rows.map(async (p) => {
        const u = await ctx.db.get(p.userId);
        const stale = now - p.heartbeatAt > STALE_MS;
        return {
          userId: p.userId,
          displayName: u?.displayName ?? "Unknown",
          avatarUrl: await resolveAvatar(ctx, u ?? null),
          state: stale ? ("offline" as const) : p.state,
          heartbeatAt: p.heartbeatAt,
        };
      }),
    );
  },
});
