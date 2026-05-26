import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  plans: defineTable({
    name: v.string(),
    slug: v.string(),
    priceCents: v.number(),
    maxRooms: v.optional(v.number()),
    maxParticipantsPerRoom: v.optional(v.number()),
    isDefault: v.boolean(),
  }).index("by_slug", ["slug"]),

  // NOTE: Convex Auth owns the `users` table (from authTables). Our app-side
  // profile lives in `appUsers`, linked by `authId`. Every foreign key in
  // this schema points at `appUsers`, not the auth row.
  appUsers: defineTable({
    displayName: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("banned"),
      v.literal("deleted"),
    ),
    isAdmin: v.boolean(),
    planId: v.id("plans"),
    authId: v.optional(v.id("users")), // links to Convex Auth users row
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_authId", ["authId"])
    .index("by_isAdmin", ["isAdmin"]),

  rooms: defineTable({
    name: v.string(),
    code: v.string(), // 6-char access code
    privacy: v.union(v.literal("private"), v.literal("link")),
    hostId: v.id("appUsers"),
    videoProvider: v.literal("youtube"),
    videoUrl: v.string(),
    videoId: v.string(), // parsed YouTube id
    videoTitle: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("ended")),
    // playback state for sync (Phase 4)
    playbackState: v.union(v.literal("playing"), v.literal("paused")),
    playbackPositionMs: v.number(),
    playbackUpdatedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_host", ["hostId"])
    .index("by_status", ["status"]),

  roomParticipants: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("appUsers"),
    role: v.union(v.literal("host"), v.literal("participant")),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
    // Host-initiated moderation
    mutedByHost: v.optional(v.boolean()),
    kickedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"])
    .index("by_room_user", ["roomId", "userId"]),

  messages: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("appUsers"),
    body: v.string(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"]),

  presence: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("appUsers"),
    state: v.union(v.literal("online"), v.literal("typing"), v.literal("offline")),
    heartbeatAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_user", ["roomId", "userId"]),

  reports: defineTable({
    reporterId: v.id("appUsers"),
    targetType: v.union(
      v.literal("user"),
      v.literal("message"),
      v.literal("room"),
    ),
    targetUserId: v.optional(v.id("appUsers")),
    targetMessageId: v.optional(v.id("messages")),
    targetRoomId: v.optional(v.id("rooms")),
    reason: v.string(),
    details: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("investigating"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    resolvedBy: v.optional(v.id("appUsers")),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_target_user", ["targetUserId"]),

  adminActions: defineTable({
    adminId: v.id("appUsers"),
    action: v.string(), // ban_user / unban_user / delete_user / end_room / update_report / edit_content / ...
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_admin", ["adminId"])
    .index("by_action", ["action"]),

  siteContent: defineTable({
    key: v.string(), // e.g. hero.headline
    section: v.string(), // e.g. hero / cta / footer
    label: v.string(), // human label for the editor
    type: v.union(
      v.literal("text"),
      v.literal("longtext"),
      v.literal("imageUrl"),
      v.literal("url"),
    ),
    value: v.string(),
  }).index("by_key", ["key"]).index("by_section", ["section"]),

  contentBlocks: defineTable({
    section: v.string(), // features / steps / usecases / testimonials / faq
    order: v.number(),
    visible: v.boolean(),
    data: v.any(), // shape depends on section — see spec Phase 8
  }).index("by_section_order", ["section", "order"]),
});
