import { Doc } from "../_generated/dataModel";

/**
 * Single 'what can this user do' surface. All gating reads from here so
 * paid plans can be added later without scattering checks across the code.
 */
export function entitlementsFor(_user: Doc<"appUsers">, _plan: Doc<"plans">) {
  return {
    maxRooms: _plan.maxRooms ?? Infinity,
    maxParticipantsPerRoom: _plan.maxParticipantsPerRoom ?? Infinity,
    canHostRoom: true,
    canVideoChat: true,
  };
}
