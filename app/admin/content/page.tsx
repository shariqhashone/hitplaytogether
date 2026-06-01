"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const BLOCK_SECTIONS = ["features", "steps", "usecases", "testimonials", "faq"] as const;
type BlockSection = (typeof BLOCK_SECTIONS)[number];

// Friendly metadata for every content area shown in the left rail.
const META: Record<string, { icon: string; title: string; blurb: string }> = {
  hero: { icon: "🦸", title: "Hero", blurb: "The headline, subtext and primary call-to-action at the very top of the landing page." },
  cta: { icon: "📣", title: "Call to action", blurb: "The conversion banner that nudges visitors to sign up." },
  footer: { icon: "🧱", title: "Footer", blurb: "Footer copy, links and legal text." },
  brand: { icon: "🔗", title: "Brand", blurb: "Logo text and tagline." },
  nav: { icon: "🧭", title: "Navigation", blurb: "Top navigation labels." },
  features: { icon: "✨", title: "Features", blurb: "The feature cards highlighting what the platform does." },
  steps: { icon: "🪜", title: "How it works", blurb: "The numbered steps explaining the flow." },
  usecases: { icon: "🎯", title: "Use cases", blurb: "Scenario cards showing who it's for." },
  testimonials: { icon: "💬", title: "Testimonials", blurb: "Social-proof quotes from users." },
  faq: { icon: "❓", title: "FAQ", blurb: "Frequently asked questions." },
};
const metaFor = (s: string) => META[s] ?? { icon: "📄", title: s, blurb: "Editable content." };

// Preferred ordering for the settings (single-field) sections.
const SETTINGS_ORDER = ["hero", "cta", "brand", "nav", "footer"];

type Active = { kind: "settings" | "blocks"; section: string };

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

  const [active, setActive] = useState<Active | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // group settings by their section
  const settingsBySection = useMemo(() => {
    const acc: Record<string, NonNullable<typeof data>["settings"]> = {};
    for (const s of data?.settings ?? []) (acc[s.section] ??= []).push(s);
    return acc;
  }, [data]);

  const settingsSections = useMemo(() => {
    const keys = Object.keys(settingsBySection);
    return keys.sort((a, b) => {
      const ai = SETTINGS_ORDER.indexOf(a), bi = SETTINGS_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
  }, [settingsBySection]);

  // default selection once data loads
  useEffect(() => {
    if (!active && settingsSections.length) {
      setActive({ kind: "settings", section: settingsSections[0] });
    }
  }, [active, settingsSections]);

  if (data === undefined || !active) {
    return (
      <AdminShell title="Content Manager"><div className="loader">Loading…</div></AdminShell>
    );
  }

  const dirtyCount = Object.keys(dirty).length;

  async function saveAll() {
    const updates = Object.entries(dirty).map(([key, value]) => ({ key, value }));
    if (!updates.length) return;
    await updateSettings({ updates });
    setDirty({});
    setSavedAt(Date.now());
  }

  const blocksFor = (s: BlockSection) => data.blocks.filter((b) => b.section === s).sort((a, b) => a.order - b.order);

  return (
    <AdminShell
      title="Content Manager"
      subtitle="Edit everything on the public landing page"
      right={<Link href="/" target="_blank" className="btn btn-ghost btn-sm">Preview site ↗</Link>}
    >
      <div className="cms-layout">
        {/* ---------------- left rail ---------------- */}
        <aside className="cms-rail">
          <div className="grp">Page copy</div>
          {settingsSections.map((s) => {
            const m = metaFor(s);
            const on = active.kind === "settings" && active.section === s;
            return (
              <button key={s} className={`item ${on ? "on" : ""}`} onClick={() => setActive({ kind: "settings", section: s })}>
                <span className="ic">{m.icon}</span>
                <span>{m.title}</span>
                <span className="ct">{settingsBySection[s].length}</span>
              </button>
            );
          })}

          <div className="grp">Repeatable sections</div>
          {BLOCK_SECTIONS.map((s) => {
            const m = metaFor(s);
            const on = active.kind === "blocks" && active.section === s;
            return (
              <button key={s} className={`item ${on ? "on" : ""}`} onClick={() => setActive({ kind: "blocks", section: s })}>
                <span className="ic">{m.icon}</span>
                <span>{m.title}</span>
                <span className="ct">{blocksFor(s).length}</span>
              </button>
            );
          })}
        </aside>

        {/* ---------------- editor pane ---------------- */}
        <section className="cms-pane">
          {active.kind === "settings" ? (
            <SettingsPane
              section={active.section}
              items={settingsBySection[active.section] ?? []}
              dirty={dirty}
              setDirty={setDirty}
            />
          ) : (
            <BlocksPane
              section={active.section as BlockSection}
              blocks={blocksFor(active.section as BlockSection)}
              onCreate={() => createBlock({ section: active.section, data: defaultBlock(active.section) })}
              onSave={(id, d) => updateBlock({ blockId: id, data: d })}
              onToggle={(id, vis) => updateBlock({ blockId: id, visible: vis })}
              onDelete={(id) => deleteBlock({ blockId: id })}
              onMove={async (arr, id, dir) => {
                const sorted = [...arr].sort((a, b) => a.order - b.order);
                const i = sorted.findIndex((x) => x._id === id);
                const j = i + dir;
                if (j < 0 || j >= sorted.length) return;
                [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
                await reorder({ section: active.section, orderedIds: sorted.map((x) => x._id as Id<"contentBlocks">) });
              }}
            />
          )}

          {/* sticky save bar — only for settings, only when dirty */}
          {active.kind === "settings" && (dirtyCount > 0 || (savedAt && Date.now() - savedAt < 2500)) && (
            <div className="cms-savebar">
              {dirtyCount > 0 ? (
                <>
                  <span className="note">{dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}</span>
                  <button className="btn btn-ghost" onClick={() => setDirty({})}>Revert</button>
                  <button className="btn btn-primary" onClick={saveAll}>Save changes</button>
                </>
              ) : (
                <span className="cms-saved">Saved ✓</span>
              )}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

/* =================== settings (single fields) =================== */

function SettingsPane({
  section, items, dirty, setDirty,
}: {
  section: string;
  items: { _id: string; key: string; label: string; type: string; value: string }[];
  dirty: Record<string, string>;
  setDirty: (d: Record<string, string>) => void;
}) {
  const m = metaFor(section);
  return (
    <>
      <div className="cms-pane-head">
        <div>
          <h2>{m.icon} {m.title}</h2>
          <p>{m.blurb}</p>
        </div>
      </div>
      <div className="cms-card">
        {items.length === 0 ? (
          <div className="empty">No editable fields in this section.</div>
        ) : (
          items.map((s) => {
            const val = dirty[s.key] ?? s.value;
            const isImg = s.type === "imageUrl";
            return (
              <div className="cms-field" key={s._id}>
                <div className="lbl-row">
                  <span className="nm">{s.label}</span>
                  <span className="key">{s.key}</span>
                </div>
                {s.type === "longtext" ? (
                  <textarea className="field" rows={3} value={val}
                    onChange={(e) => setDirty({ ...dirty, [s.key]: e.target.value })} />
                ) : (
                  <input className="field" value={val} placeholder={isImg ? "https://…" : ""}
                    onChange={(e) => setDirty({ ...dirty, [s.key]: e.target.value })} />
                )}
                {isImg && val && <img className="cms-img-prev" src={val} alt="" />}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* =================== blocks (repeatable) =================== */

function BlocksPane({
  section, blocks, onCreate, onSave, onToggle, onDelete, onMove,
}: {
  section: BlockSection;
  blocks: { _id: string; data: any; visible: boolean; order: number; section: string }[];
  onCreate: () => void;
  onSave: (id: Id<"contentBlocks">, d: any) => void;
  onToggle: (id: Id<"contentBlocks">, vis: boolean) => void;
  onDelete: (id: Id<"contentBlocks">) => void;
  onMove: (arr: typeof blocks, id: string, dir: number) => Promise<void>;
}) {
  const m = metaFor(section);
  return (
    <>
      <div className="cms-pane-head">
        <div>
          <h2>{m.icon} {m.title}</h2>
          <p>{m.blurb} · {blocks.length} block{blocks.length === 1 ? "" : "s"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onCreate}>+ Add block</button>
      </div>

      {blocks.length === 0 ? (
        <div className="empty">No blocks yet — click “Add block” to create the first one.</div>
      ) : (
        blocks.map((b, idx) => (
          <BlockEditor
            key={b._id}
            block={b}
            index={idx}
            total={blocks.length}
            onSave={(d) => onSave(b._id as Id<"contentBlocks">, d)}
            onToggle={() => onToggle(b._id as Id<"contentBlocks">, !b.visible)}
            onDelete={() => { if (confirm("Delete this block?")) onDelete(b._id as Id<"contentBlocks">); }}
            onMove={(dir) => onMove(blocks, b._id, dir)}
          />
        ))
      )}
    </>
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

const friendly = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const isImageField = (k: string, v: any) =>
  /url|image|avatar|photo/i.test(k) && typeof v === "string" && /^https?:\/\//.test(v);

function blockTitle(section: string, data: any): string {
  return data.title || data.question || data.name || data.quote || `${section} block`;
}

function BlockEditor({
  block, index, total, onSave, onToggle, onDelete, onMove,
}: {
  block: { _id: string; data: any; visible: boolean };
  index: number;
  total: number;
  onSave: (d: any) => void | Promise<void>;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: number) => void | Promise<unknown>;
}) {
  const [data, setData] = useState<any>(block.data);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setData(block.data); setDirty(false); }, [block._id]);

  function set(field: string, value: any, numeric: boolean) {
    setData({ ...data, [field]: numeric ? (value === "" ? 0 : Number(value)) : value });
    setDirty(true);
  }

  return (
    <div className={`cms-block ${block.visible ? "" : "hidden-blk"}`}>
      <div className="row">
        <span className="b-idx">{index + 1}</span>
        <div>
          <div className="b-ttl">{String(blockTitle("", data))}</div>
          <div className="b-sub">{block.visible ? "Visible on site" : "Hidden"}</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button className="btn btn-ghost btn-sm" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
          <button className="btn btn-ghost btn-sm" onClick={onToggle}>{block.visible ? "Hide" : "Show"}</button>
          <button className="btn btn-ghost btn-sm" onClick={onDelete} style={{ color: "var(--brand)" }}>Delete</button>
        </div>
      </div>
      <div className="cms-grid">
        {Object.entries(data).map(([k, v]) => {
          const numeric = typeof v === "number";
          const long = !numeric && String(v).length > 60;
          const img = isImageField(k, v);
          return (
            <div key={k} className={long || img ? "full" : ""}>
              <div className="lbl-row" style={{ marginBottom: 6 }}>
                <span className="nm">{friendly(k)}</span>
              </div>
              {long ? (
                <textarea className="field" rows={3} value={String(v)} onChange={(e) => set(k, e.target.value, false)} />
              ) : (
                <input className="field" type={numeric ? "number" : "text"} value={String(v)}
                  onChange={(e) => set(k, e.target.value, numeric)} />
              )}
              {img && <img className="cms-img-prev" src={String(v)} alt="" />}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary btn-sm" disabled={!dirty}
          onClick={async () => { await onSave(data); setDirty(false); }}>
          Save block
        </button>
      </div>
    </div>
  );
}
