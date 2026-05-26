import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

async function logEdit(ctx: any, adminId: any, action: string, targetId?: string, meta?: unknown) {
  await ctx.db.insert("adminActions", {
    adminId,
    action,
    targetType: "content",
    targetId,
    metadata: meta,
  });
}

/**
 * Public landing-page content. No auth required — these are the bits
 * everyone sees on the front page.
 */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const settingsRows = await ctx.db.query("siteContent").collect();
    const blocksRows = await ctx.db.query("contentBlocks").collect();

    const settings: Record<string, string> = {};
    for (const s of settingsRows) settings[s.key] = s.value;

    const blocks: Record<string, any[]> = {};
    for (const b of blocksRows) {
      if (!b.visible) continue;
      (blocks[b.section] ??= []).push({ _id: b._id, ...b.data, order: b.order });
    }
    for (const k of Object.keys(blocks)) blocks[k].sort((a, b) => a.order - b.order);
    return { settings, blocks };
  },
});

/** Same shape as getPublic but admin-only and includes hidden blocks + editor metadata. */
export const getForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await ctx.db.query("siteContent").collect();
    const blocks = await ctx.db.query("contentBlocks").collect();
    blocks.sort((a, b) => a.order - b.order);
    return { settings, blocks };
  },
});

export const updateSettings = mutation({
  args: {
    updates: v.array(v.object({ key: v.string(), value: v.string() })),
  },
  handler: async (ctx, { updates }) => {
    const admin = await requireAdmin(ctx);
    for (const u of updates) {
      const row = await ctx.db
        .query("siteContent")
        .withIndex("by_key", (q) => q.eq("key", u.key))
        .first();
      if (row) await ctx.db.patch(row._id, { value: u.value });
    }
    await logEdit(ctx, admin._id, "edit_content", undefined, { keys: updates.map((u) => u.key) });
  },
});

export const createBlock = mutation({
  args: { section: v.string(), data: v.any() },
  handler: async (ctx, { section, data }) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("contentBlocks")
      .withIndex("by_section_order", (q) => q.eq("section", section))
      .collect();
    const nextOrder = existing.length;
    const id = await ctx.db.insert("contentBlocks", {
      section,
      order: nextOrder,
      visible: true,
      data,
    });
    await logEdit(ctx, admin._id, "edit_content", id, { op: "create", section });
    return id;
  },
});

export const updateBlock = mutation({
  args: {
    blockId: v.id("contentBlocks"),
    data: v.optional(v.any()),
    visible: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { blockId, data, visible, order }) => {
    const admin = await requireAdmin(ctx);
    const patch: Record<string, unknown> = {};
    if (data !== undefined) patch.data = data;
    if (visible !== undefined) patch.visible = visible;
    if (order !== undefined) patch.order = order;
    await ctx.db.patch(blockId, patch);
    await logEdit(ctx, admin._id, "edit_content", blockId, { op: "update" });
  },
});

export const deleteBlock = mutation({
  args: { blockId: v.id("contentBlocks") },
  handler: async (ctx, { blockId }) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.delete(blockId);
    await logEdit(ctx, admin._id, "edit_content", blockId, { op: "delete" });
  },
});

export const reorderBlocks = mutation({
  args: {
    section: v.string(),
    orderedIds: v.array(v.id("contentBlocks")),
  },
  handler: async (ctx, { section, orderedIds }) => {
    const admin = await requireAdmin(ctx);
    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { order: i });
    }
    await logEdit(ctx, admin._id, "edit_content", undefined, { op: "reorder", section });
  },
});
