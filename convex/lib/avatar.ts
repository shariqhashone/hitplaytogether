import { Doc } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Single helper to resolve a user's avatar to a URL. Prefers the uploaded
 * file (avatarStorageId) over the legacy external URL string (avatarUrl).
 * Returns null when neither is set.
 */
export async function resolveAvatar(
  ctx: Ctx,
  user: Doc<"appUsers"> | null | undefined,
): Promise<string | null> {
  if (!user) return null;
  if (user.avatarStorageId) {
    const url = await ctx.storage.getUrl(user.avatarStorageId);
    if (url) return url;
  }
  return user.avatarUrl ?? null;
}
