"use client";
import { useEffect, useRef, useState } from "react";

const EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤔", "🤩",
  "🥳", "😭", "😱", "😡", "🤯", "🥺", "😴", "🤤", "🤐", "🤫",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "✌️", "🤘", "🤙", "👌",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️",
  "🔥", "✨", "⭐", "🌟", "💫", "🎉", "🎊", "🎈", "🎁", "🍿",
  "👀", "🫶", "🤝", "🫡", "🤡", "👻", "🤖", "💯", "✅", "❌",
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div ref={ref} className="emoji-picker">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className="emoji-btn"
          onClick={() => {
            onPick(e);
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function EmojiToggle({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="emoji-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Pick an emoji"
      >
        😊
      </button>
      {open && (
        <EmojiPicker
          onPick={(e) => {
            onPick(e);
            // keep picker open for multi-pick; close on outside click
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Returns true if a chat message is purely emoji + whitespace — used by the
 * watch room to decide whether to spawn the floating animation.
 */
export function isMostlyEmoji(text: string): boolean {
  if (!text) return false;
  // Strip whitespace + variation selectors + ZWJ
  const stripped = text.replace(/[\s‍️]/g, "");
  if (!stripped) return false;
  // Match any emoji codepoint (rough — covers most). If after removing them
  // there's nothing left, it's emoji-only.
  const noEmoji = stripped.replace(
    /[\u{1f300}-\u{1faff}\u{2600}-\u{27bf}\u{1f000}-\u{1f2ff}]/gu,
    "",
  );
  return noEmoji.length === 0 && stripped.length <= 12;
}
