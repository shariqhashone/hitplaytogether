"use client";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Tab = "settings" | "blocks";
const SECTIONS = ["features", "steps", "usecases", "testimonials", "faq"] as const;

export default function AdminContentPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && me?.isAdmin === true;
  const data = useQuery(api.content.getForAdmin, canQuery ? {} : "skip");
  const updateSettings = useMutation(api.content.updateSettings);
  const createBlock = useMutation(api.content.createBlock);
  const updateBlock = useMutation(api.content.updateBlock);
  const deleteBlock = useMutation(api.content.deleteBlock);
  const reorder = useMutation(api.content.reorderBlocks);

  const [tab, setTab] = useState<Tab>("settings");
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("features");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => setDirty({}), [data?.settings.length]);

  if (data === undefined) {
    return (<AdminShell title="Content Manager"><div className="loader">Loading…</div></AdminShell>);
  }

  const settingsBySection = data.settings.reduce<Record<string, typeof data.settings>>((acc, s) => {
    (acc[s.section] ??= []).push(s);
    return acc;
  }, {});

  async function saveAll() {
    const updates = Object.entries(dirty).map(([key, value]) => ({ key, value }));
    if (!updates.length) return;
    await updateSettings({ updates });
    setDirty({});
    setSavedAt(Date.now());
  }

  return (
    <AdminShell title="Content Manager">
      <div className="cms-tabs">
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings (single fields)
        </button>
        <button className={tab === "blocks" ? "active" : ""} onClick={() => setTab("blocks")}>
          Sections (repeatable blocks)
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--txt-3)", alignSelf: "center" }}>
          {savedAt && Date.now() - savedAt < 3000 && "Saved ✓"}
        </span>
      </div>

      {tab === "settings" && (
        <>
          {Object.entries(settingsBySection).map(([sec, items]) => (
            <div key={sec} className="chart-card" style={{ marginBottom: 14 }}>
              <h3 style={{ textTransform: "capitalize" }}>{sec}</h3>
              <div className="cms-grid">
                {items.map((s) => {
                  const val = dirty[s.key] ?? s.value;
                  return (
                    <div key={s._id}>
                      <label className="lbl">
                        {s.label} <span style={{ color: "var(--txt-3)" }}>· {s.key}</span>
                      </label>
                      {s.type === "longtext" ? (
                        <textarea
                          className="field"
                          rows={3}
                          value={val}
                          onChange={(e) => setDirty({ ...dirty, [s.key]: e.target.value })}
                        />
                      ) : (
                        <input
                          className="field"
                          value={val}
                          onChange={(e) => setDirty({ ...dirty, [s.key]: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setDirty({})} disabled={!Object.keys(dirty).length}>
              Revert
            </button>
            <button className="btn btn-primary" onClick={saveAll} disabled={!Object.keys(dirty).length}>
              Save {Object.keys(dirty).length || ""} changes
            </button>
          </div>
        </>
      )}

      {tab === "blocks" && (
        <>
          <div className="cms-section-tabs">
            {SECTIONS.map((s) => (
              <button key={s} className={section === s ? "active" : ""} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={() => createBlock({ section, data: defaultBlock(section) })}
            >
              + Add block
            </button>
          </div>
          {data.blocks.filter((b) => b.section === section).length === 0 ? (
            <div className="empty">No blocks in this section yet.</div>
          ) : (
            data.blocks
              .filter((b) => b.section === section)
              .map((b, idx, arr) => (
                <BlockEditor
                  key={b._id}
                  block={b}
                  index={idx}
                  total={arr.length}
                  onSave={(d) => updateBlock({ blockId: b._id as Id<"contentBlocks">, data: d })}
                  onToggle={() => updateBlock({ blockId: b._id as Id<"contentBlocks">, visible: !b.visible })}
                  onDelete={() => {
                    if (confirm("Delete this block?")) deleteBlock({ blockId: b._id as Id<"contentBlocks"> });
                  }}
                  onMove={async (dir) => {
                    const sorted = [...arr].sort((a, b) => a.order - b.order);
                    const i = sorted.findIndex((x) => x._id === b._id);
                    const j = i + dir;
                    if (j < 0 || j >= sorted.length) return;
                    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
                    await reorder({
                      section,
                      orderedIds: sorted.map((x) => x._id as Id<"contentBlocks">),
                    });
                  }}
                />
              ))
          )}
        </>
      )}
    </AdminShell>
  );
}

function defaultBlock(section: string): any {
  switch (section) {
    case "features": return { icon: "✨", iconColor: "a", title: "New feature", body: "Describe it.", imageUrl: "" };
    case "steps": return { number: 1, title: "Step title", body: "What the user does." };
    case "usecases": return { emoji: "🎬", title: "Use case", body: "Describe it.", imageUrl: "" };
    case "testimonials": return { quote: "Quote here.", name: "Name", role: "Role", stars: 5, avatarUrl: "" };
    case "faq": return { question: "Question?", answer: "Answer." };
    default: return {};
  }
}

function BlockEditor({ block, index, total, onSave, onToggle, onDelete, onMove }: any) {
  const [data, setData] = useState<any>(block.data);
  const [dirty, setDirty] = useState(false);
  useEffect(() => setData(block.data), [block._id]);

  function set(field: string, value: any) {
    setData({ ...data, [field]: value });
    setDirty(true);
  }

  return (
    <div className="cms-block">
      <div className="row">
        <div style={{ fontSize: 12, color: "var(--txt-3)" }}>
          #{index + 1} of {total} · {block.visible ? "Visible" : "Hidden"}
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button className="btn btn-ghost btn-sm" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
          <button className="btn btn-ghost btn-sm" onClick={onToggle}>{block.visible ? "Hide" : "Show"}</button>
          <button className="btn btn-ghost btn-sm" onClick={onDelete} style={{ color: "var(--brand)" }}>Delete</button>
        </div>
      </div>
      <div className="cms-grid">
        {Object.entries(data).map(([k, v]) => (
          <div key={k}>
            <label className="lbl">{k}</label>
            {String(v).length > 80 ? (
              <textarea
                className="field"
                rows={3}
                value={String(v)}
                onChange={(e) => set(k, e.target.value)}
              />
            ) : (
              <input
                className="field"
                value={String(v)}
                onChange={(e) => set(k, isNaN(Number(v)) ? e.target.value : Number(e.target.value))}
              />
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={async () => { await onSave(data); setDirty(false); }}>
          Save block
        </button>
      </div>
    </div>
  );
}
