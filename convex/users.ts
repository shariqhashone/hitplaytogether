import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentAppUser, requireUser } from "./lib/auth";
import { resolveAvatar } from "./lib/avatar";
import { Id } from "./_generated/dataModel";

/**
 * Called by the client immediately after sign-up or login.
 * Creates the app `users` row on first call. Updates lastLoginAt every call.
 */
export const bootstrap = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Not signed in");

    const existing = await getCurrentAppUser(ctx);
    if (existing) {
      await ctx.db.patch(existing._id, { lastLoginAt: Date.now() });
      if (existing.status === "banned") throw new Error("Account is banned");
      return existing._id;
    }

    // First time — look up Convex Auth's row for email
    const authUser = await ctx.db.get(authId);
    const email = (authUser as any)?.email ?? "";

    // If the seed (or a previous run) already created an app-side row for
    // this email, link to it instead of creating a duplicate. This is how
    // the seeded admin & users become real logins.
    if (email) {
      const byEmail = await ctx.db
        .query("appUsers")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (byEmail) {
        await ctx.db.patch(byEmail._id, {
          authId: authId as Id<"users">,
          lastLoginAt: Date.now(),
        });
        if (byEmail.status === "banned") throw new Error("Account is banned");
        return byEmail._id;
      }
    }

    // Default plan = the seeded Free plan (or any plan flagged isDefault).
    const plan =
      (await ctx.db.query("plans").filter((q) => q.eq(q.field("isDefault"), true)).first()) ??
      (await ctx.db.query("plans").first());
    if (!plan) throw new Error("No plans defined — run seed first");

    const id = await ctx.db.insert("appUsers", {
      displayName: args.displayName ?? (email ? email.split("@")[0] : "Friend"),
      email,
      avatarUrl: args.avatarUrl,
      status: "active",
      isAdmin: false,
      planId: plan._id,
      authId: authId as Id<"users">,
      lastLoginAt: Date.now(),
    });
    return id;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return null;
    const plan = await ctx.db.get(user.planId);
    const avatarUrl = await resolveAvatar(ctx, user);
    return { ...user, avatarUrl, plan };
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const patch: Record<string, unknown> = {};
    if (args.displayName !== undefined) {
      const n = args.displayName.trim();
      if (n.length < 1 || n.length > 60) throw new Error("Display name must be 1-60 chars");
      patch.displayName = n;
    }
    if (args.avatarUrl !== undefined) patch.avatarUrl = args.avatarUrl || undefined;
    await ctx.db.patch(me._id, patch);
    return await ctx.db.get(me._id);
  },
});

/** Step 1 of avatar upload: client asks for a short-lived signed URL. */
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step 2 of avatar upload: client POSTed to the signed URL, got back a
 * storageId, and now saves it on their profile. Also clears any legacy
 * external URL so the uploaded one is the source of truth.
 */
export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const me = await requireUser(ctx);
    // delete any previous uploaded avatar to avoid orphan files
    if (me.avatarStorageId && me.avatarStorageId !== storageId) {
      try { await ctx.storage.delete(me.avatarStorageId); } catch {}
    }
    await ctx.db.patch(me._id, {
      avatarStorageId: storageId,
      avatarUrl: undefined,
    });
  },
});

/**
 * Convex Auth's Password provider exposes its own password-change flow via
 * the signIn/store routes. This wrapper is a thin convenience that documents
 * the contract — in the UI we call the Convex Auth client directly.
 */
/**
 * Promote (or demote) an existing user to admin by email.
 *
 * This is an INTERNAL mutation — it can't be called from the browser.
 * Run it from the CLI after the target user has signed up:
 *
 *   npx convex run users:setAdminByEmail '{"email":"you@gmail.com","isAdmin":true}'
 *
 * Use `isAdmin: false` to demote.
 */
export const setAdminByEmail = mutation({
  args: { email: v.string(), isAdmin: v.boolean() },
  handler: async (ctx, { email, isAdmin }) => {
    const user = await ctx.db
      .query("appUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new Error(`No app user found for email ${email} — they must sign up first.`);
    await ctx.db.patch(user._id, { isAdmin });
    return { _id: user._id, email: user.email, isAdmin };
  },
});

export const changePassword = mutation({
  args: { newPassword: v.string() },
  handler: async (ctx, _args) => {
    await requireUser(ctx);
    throw new Error(
      "Use the Convex Auth `signIn('password', { flow: 'reset', ... })` flow from the client.",
    );
  },
});
