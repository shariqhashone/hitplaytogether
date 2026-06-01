"use client";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { friendlyError } from "@/lib/clientError";

export default function AdminSettingsPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const settings = useQuery(api.admin.getSettings, canQuery ? {} : "skip");
  const update = useMutation(api.admin.updateSettings);

  const [maxPeople, setMaxPeople] = useState("0");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setMaxPeople(String(settings.maxParticipantsPerRoom ?? 0));
  }, [settings]);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      await update({ maxParticipantsPerRoom: Number(maxPeople) || 0 });
      setSavedAt(Date.now());
    } catch (e) {
      setErr(friendlyError(e, "Could not save settings."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Settings" subtitle="Global platform configuration">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-head">
          <h3>Room capacity</h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--txt-3)", marginBottom: 18, lineHeight: 1.5 }}>
          The maximum number of people allowed in a single watch room. New joiners
          are blocked once a room is full. Set to <b>0</b> for unlimited.
        </p>

        <label className="lbl">Max people per room</label>
        <input
          className="field"
          type="number"
          min={0}
          max={1000}
          value={maxPeople}
          onChange={(e) => setMaxPeople(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 8 }}>
          {Number(maxPeople) > 0 ? `Rooms capped at ${maxPeople} ${Number(maxPeople) === 1 ? "person" : "people"}.` : "No limit — rooms can hold any number of people."}
        </div>

        {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}

        <div className="divider" style={{ margin: "20px 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
          {savedAt && Date.now() - savedAt < 2500 && (
            <span className="cms-saved">Saved ✓</span>
          )}
          <button className="btn btn-primary" onClick={save} disabled={busy || settings === undefined}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
