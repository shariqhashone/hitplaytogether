import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { resolveAvatar } from "./lib/avatar";

const MAX_LEN = 1000;

export const list = query({
  args: { roomId: v.id("rooms"), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, limit }) => {
    const me = await requireUser(ctx);

    const room = await ctx.db.get(roomId);
    if (!room) return [];

    // member check (link rooms are public to read; private requires membership)
    if (room.privacy === "private") {
      const member = await ctx.db
        .query("roomParticipants")
        .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", me._id))
        .first();
      if (!member) throw new Error("Not a participant of this room");
    }

    const rows = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(limit ?? 100);

    // Build a set of users the host has muted in this room — their messages
    // are hidden from everyone (and they're blocked from sending new ones
    // in `send` below).
    const parts = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const mutedUserIds = new Set(
      parts.filter((p) => p.mutedByHost).map((p) => String(p.userId)),
    );

    const enriched = await Promise.all(
      rows
        .filter((m) => !m.deletedAt && !mutedUserIds.has(String(m.userId)))
        .reverse()
        .map(async (m) => {
          const u = await ctx.db.get(m.userId);
          return {
            _id: m._id,
            roomId: m.roomId,
            userId: m.userId,
            body: m.body,
            createdAt: m._creationTime,
            authorName: u?.displayName ?? "Unknown",
            authorAvatar: await resolveAvatar(ctx, u ?? null),
            isMe: m.userId === me._id,
          };
        }),
    );
    return enriched;
  },
});

export const send = mutation({
  args: { roomId: v.id("rooms"), body: v.string() },
  handler: async (ctx, { roomId, body }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== "active") throw new Error("Room has ended");

    const member = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", me._id))
      .first();
    if (!member) throw new Error("Not a participant of this room");
    if (member.mutedByHost) {
      throw new Error("You're muted by the host — you can't send messages.");
    }

    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message is empty");
    if (trimmed.length > MAX_LEN) throw new Error(`Message too long (max ${MAX_LEN})`);

    return await ctx.db.insert("messages", {
      roomId,
      userId: me._id,
      body: trimmed,
    });
  },
});
