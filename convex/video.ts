"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { AccessToken } from "livekit-server-sdk";
import { api } from "./_generated/api";

/**
 * Mint a short-lived LiveKit access token for this user + this room.
 *
 * - Returns the WSS URL + JWT so the browser can connect with `livekit-client`.
 * - Recording is NOT enabled in the SDK config — calls are live only.
 * - The secret never leaves the Convex action.
 */
export const getToken = action({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }): Promise<{ url: string; token: string; identity: string }> => {
    // resolve the caller via a Convex query (actions don't see the DB directly)
    const me = (await ctx.runQuery(api.users.me, {})) as
      | { _id: string; displayName: string; status: string }
      | null;
    if (!me) throw new Error("Not signed in");
    if (me.status !== "active") throw new Error("Account is not active");

    const room = (await ctx.runQuery(api.rooms.get, { roomId })) as
      | { room: { _id: string; status: string }; participants: Array<{ userId: string }> }
      | null;
    if (!room) throw new Error("Room not found");
    if (room.room.status !== "active") throw new Error("Room has ended");
    if (!room.participants.some((p) => p.userId === me._id)) {
      throw new Error("Not a participant of this room");
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) {
      throw new Error(
        "LiveKit env not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL via `npx convex env set`.",
      );
    }

    const identity = String(me._id);
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: me.displayName,
      ttl: 60 * 60, // 1h
    });
    at.addGrant({
      room: `room_${roomId}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return { url, token, identity };
  },
});
