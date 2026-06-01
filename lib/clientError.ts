/**
 * Turns a raw Convex/JS error into a clean, human-friendly sentence.
 *
 * Convex surfaces server errors to the browser like:
 *   "[CONVEX M(rooms:create)] [Request ID: abc] Server Error
 *    Uncaught Error: Could not parse a YouTube video from that URL
 *        at handler (../convex/rooms.ts:35:23)
 *      Called by client"
 *
 * Users should never see the request ID, file path, or "Uncaught Error".
 * This extracts just the message we threw on the server.
 */
export function friendlyError(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!e) return fallback;

  // ConvexError carries a clean payload in `.data`
  const data = (e as any)?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object" && typeof (data as any).message === "string") {
    return (data as any).message;
  }

  let raw = String((e as any)?.message ?? e ?? "");

  // Grab the text after the last "Error:" marker (handles "Uncaught Error:",
  // "ConvexError:", "Error:").
  const parts = raw.split(/Uncaught Error:|ConvexError:|Error:/);
  let msg = (parts.length > 1 ? parts[parts.length - 1] : raw);

  // Cut off the stack trace / Convex framing that follows the message.
  msg = msg.split(/\n| at handler| Called by client| at async /)[0];

  // Strip any leftover Convex prefixes.
  msg = msg
    .replace(/^\s*\[CONVEX[^\]]*\]\s*/i, "")
    .replace(/\[Request ID:[^\]]*\]/i, "")
    .replace(/Server Error/i, "")
    .trim();

  return msg || fallback;
}
