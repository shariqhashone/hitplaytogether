import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { extractYouTubeId } from "./lib/youtube";
import { generateRoomCode } from "./lib/code";
import { resolveAvatar } from "./lib/avatar";
import { Doc, Id } from "./_generated/dataModel";

async function uniqueCode(ctx: any): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateRoomCode();
    const clash = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();
    if (!clash) return code;
  }
  throw new Error("Could not allocate a unique room code");
}

export const create = mutation({
  args: {
    name: v.string(),
    privacy: v.union(v.literal("private"), v.literal("link")),
    videoUrl: v.string(),
    videoTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const name = args.name.trim();
    if (!name || name.length > 80) throw new Error("Room name is required (max 80 chars)");

    const videoId = extractYouTubeId(args.videoUrl);
    if (!videoId) throw new Error("Could not parse a YouTube video from that URL");

    const code = await uniqueCode(ctx);
    const roomId = await ctx.db.insert("rooms", {
      name,
      code,
      privacy: args.privacy,
      hostId: me._id,
      videoProvider: "youtube",
      videoUrl: args.videoUrl,
      videoId,
      videoTitle: args.videoTitle,
      status: "active",
      playbackState: "paused",
      playbackPositionMs: 0,
      playbackUpdatedAt: Date.now(),
    });

    await ctx.db.insert("roomParticipants", {
      roomId,
      userId: me._id,
      role: "host",
      joinedAt: Date.now(),
    });

    return { roomId, code };
  },
});

export const myRooms = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    // hosted
    const hosted = await ctx.db
      .query("rooms")
      .withIndex("by_host", (q) => q.eq("hostId", me._id))
      .order("desc")
      .take(50);
    // joined
    const joined = await ctx.db
      .query("roomParticipants")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(50);

    const seen = new Set<string>();
    const result: Array<Doc<"rooms"> & { participantCount: number; role: "host" | "participant" }> = [];
    for (const r of hosted) {
      if (seen.has(r._id)) continue;
      seen.add(r._id);
      const ps = await ctx.db
        .query("roomParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", r._id))
        .collect();
      result.push({ ...r, participantCount: ps.filter((p) => !p.leftAt).length, role: "host" });
    }
    for (const j of joined) {
      if (seen.has(j.roomId)) continue;
      const room = await ctx.db.get(j.roomId);
      if (!room) continue;
      seen.add(room._id);
      const ps = await ctx.db
        .query("roomParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      result.push({
        ...room,
        participantCount: ps.filter((p) => !p.leftAt).length,
        role: "participant",
      });
    }
    result.sort((a, b) => b._creationTime - a._creationTime);
    return result.slice(0, 24);
  },
});

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) return null;

    const participants = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const isMember = participants.some((p) => p.userId === me._id);
    // For private rooms, non-members get a clear flag rather than a thrown
    // error — the watch-room page uses it to redirect to /join-room.
    if (!isMember && room.privacy === "private") {
      return {
        accessDenied: true as const,
        roomName: room.name,
        privacy: room.privacy,
      };
    }

    const withUsers = await Promise.all(
      participants
        .filter((p) => !p.leftAt)
        .map(async (p) => {
          const u = await ctx.db.get(p.userId);
          return {
            participantId: p._id,
            userId: p.userId,
            role: p.role,
            displayName: u?.displayName ?? "Unknown",
            avatarUrl: await resolveAvatar(ctx, u ?? null),
            mutedByHost: !!p.mutedByHost,
            kickedAt: p.kickedAt,
            canShareScreen: !!p.canShareScreen,
            screenShareRequestedAt: p.screenShareRequestedAt,
          };
        }),
    );

    // Has the caller been kicked from this room?
    const myParticipant = participants.find((p) => p.userId === me._id);
    const wasKicked = !!myParticipant?.kickedAt;
    const myMutedByHost = !!myParticipant?.mutedByHost;
    const myCanShareScreen = room.hostId === me._id || !!myParticipant?.canShareScreen;
    const myScreenShareRequestedAt = myParticipant?.screenShareRequestedAt;

    return {
      room,
      participants: withUsers,
      meIsHost: room.hostId === me._id,
      wasKicked,
      myMutedByHost,
      myCanShareScreen,
      myScreenShareRequestedAt,
    };
  },
});

async function hostOnly(ctx: any, roomId: any) {
  const me = await requireUser(ctx);
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Room not found");
  if (room.hostId !== me._id) throw new Error("Host only");
  return { me, room };
}

export const setParticipantMute = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("appUsers"), muted: v.boolean() },
  handler: async (ctx, { roomId, userId, muted }) => {
    await hostOnly(ctx, roomId);
    const p = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .first();
    if (!p) throw new Error("Participant not found");
    await ctx.db.patch(p._id, { mutedByHost: muted });
  },
});

/** Non-host asks the host for screen-share permission. */
export const requestScreenShare = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId === me._id) return; // host doesn't need to request
    const p = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", me._id))
      .first();
    if (!p) throw new Error("Not a participant of this room");
    await ctx.db.patch(p._id, { screenShareRequestedAt: Date.now() });
  },
});

/** Non-host cancels their own pending request. */
export const cancelScreenShareRequest = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await requireUser(ctx);
    const p = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", me._id))
      .first();
    if (!p) return;
    await ctx.db.patch(p._id, { screenShareRequestedAt: undefined });
  },
});

/** Host grants (or denies) screen-share permission. */
export const setScreenSharePermission = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("appUsers"), allowed: v.boolean() },
  handler: async (ctx, { roomId, userId, allowed }) => {
    await hostOnly(ctx, roomId);
    const p = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .first();
    if (!p) throw new Error("Participant not found");
    await ctx.db.patch(p._id, {
      canShareScreen: allowed,
      screenShareRequestedAt: undefined, // resolve the request either way
    });
  },
});

export const kickParticipant = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("appUsers") },
  handler: async (ctx, { roomId, userId }) => {
    const { room } = await hostOnly(ctx, roomId);
    if (userId === room.hostId) throw new Error("Cannot kick the host");
    const p = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .first();
    if (!p) throw new Error("Participant not found");
    await ctx.db.patch(p._id, { kickedAt: Date.now(), leftAt: Date.now() });
  },
});

/**
 * Auto-join via shareable link. Only works for rooms whose privacy is
 * "link" — private rooms still require the 6-char code via `join`.
 */
export const joinByLink = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== "active") throw new Error("This room has ended");
    if (room.privacy !== "link") {
      throw new Error("This room is private — use the access code to join.");
    }

    const existing = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", room._id).eq("userId", me._id))
      .first();

    if (existing) {
      if (existing.leftAt) {
        await ctx.db.patch(existing._id, { leftAt: undefined, joinedAt: Date.now() });
      }
      return { roomId: room._id };
    }

    await ctx.db.insert("roomParticipants", {
      roomId: room._id,
      userId: me._id,
      role: "participant",
      joinedAt: Date.now(),
    });
    return { roomId: room._id };
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const me = await requireUser(ctx);
    const normalized = code.trim().toUpperCase();
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .unique();
    if (!room) throw new Error("Invalid room code");
    if (room.status !== "active") throw new Error("This room has ended");

    const existing = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", room._id).eq("userId", me._id))
      .first();

    if (existing) {
      if (existing.leftAt) await ctx.db.patch(existing._id, { leftAt: undefined, joinedAt: Date.now() });
      return { roomId: room._id };
    }

    await ctx.db.insert("roomParticipants", {
      roomId: room._id,
      userId: me._id,
      role: "participant",
      joinedAt: Date.now(),
    });
    return { roomId: room._id };
  },
});

export const changeVideo = mutation({
  args: { roomId: v.id("rooms"), videoUrl: v.string(), videoTitle: v.optional(v.string()) },
  handler: async (ctx, { roomId, videoUrl, videoTitle }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== me._id) throw new Error("Host only");
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) throw new Error("Could not parse a YouTube video from that URL");
    await ctx.db.patch(roomId, {
      videoUrl,
      videoId,
      videoTitle,
      playbackState: "paused",
      playbackPositionMs: 0,
      playbackUpdatedAt: Date.now(),
    });
  },
});

export const end = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== me._id) throw new Error("Host only");
    await ctx.db.patch(roomId, { status: "ended", endedAt: Date.now() });
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await requireUser(ctx);
    const p = await ctx.db
      .query("roomParticipants")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", me._id))
      .first();
    if (!p) return;
    await ctx.db.patch(p._id, { leftAt: Date.now() });
  },
});

// ============== Phase 4: realtime sync mutation lives here too ==============

export const setPlayback = mutation({
  args: {
    roomId: v.id("rooms"),
    state: v.union(v.literal("playing"), v.literal("paused")),
    positionMs: v.number(),
  },
  handler: async (ctx, { roomId, state, positionMs }) => {
    const me = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== me._id) throw new Error("Only the host can change playback");
    if (positionMs < 0) throw new Error("positionMs must be >= 0");
    await ctx.db.patch(roomId, {
      playbackState: state,
      playbackPositionMs: Math.floor(positionMs),
      playbackUpdatedAt: Date.now(),
    });
  },
});
