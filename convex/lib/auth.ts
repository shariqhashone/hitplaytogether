import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Resolve the app-level `users` row for the signed-in Convex Auth identity.
 * Creates the app row on first call (so registration via Convex Auth flows
 * here on the next authenticated call).
 */
export async function getCurrentAppUser(ctx: Ctx): Promise<Doc<"appUsers"> | null> {
  const authId = await getAuthUserId(ctx);
  if (!authId) return null;
  const existing = await ctx.db
    .query("appUsers")
    .withIndex("by_authId", (q) => q.eq("authId", authId as Id<"users">))
    .unique();
  return existing ?? null;
}

export async function requireUser(ctx: Ctx): Promise<Doc<"appUsers">> {
  const user = await getCurrentAppUser(ctx);
  if (!user) throw new Error("Not signed in");
  if (user.status !== "active") throw new Error("Account is not active");
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"appUsers">> {
  const user = await requireUser(ctx);
  if (!user.isAdmin) throw new Error("Admin only");
  return user;
}
