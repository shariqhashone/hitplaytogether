"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { PublicNav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const FALLBACK = {
  settings: {
    "hero.pill": "Watch together, in sync",
    "hero.headline1": "Press play.",
    "hero.headline2": "Together.",
    "hero.subhead":
      "Create private watch rooms, sync your video to the millisecond, and react in real time with live chat — no matter where your friends are.",
    "hero.ctaPrimary": "Create a watch room",
    "hero.ctaSecondary": "See how it works",
    "hero.image": "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&q=80",
    "features.pill": "Features",
    "features.heading": "Everything you need to watch as one",
    "features.sub": "Built for movie nights, study groups, and long-distance hangouts.",
    "steps.pill": "How it works",
    "steps.heading": "Three steps to your first watch party",
    "steps.sub": "No downloads. No setup. Just press play.",
    "usecases.pill": "Made for every hangout",
    "usecases.heading": "One platform, endless watch parties",
    "testimonials.pill": "Loved by watch parties",
    "testimonials.heading": "What early users are saying",
    "faq.heading": "Frequently asked questions",
    "cta.heading": "Ready to press play together?",
    "cta.sub": "Create your first watch room in under a minute.",
    "cta.button": "Create a watch room",
    "footer.tagline": "Watch together, in sync — wherever your friends are.",
    "footer.copyright": "© 2026 HitPlayTogether.com — All rights reserved.",
  } as Record<string, string>,
  blocks: {
    features: [], steps: [], usecases: [], testimonials: [], faq: [], band: [],
  } as Record<string, any[]>,
};

export default function LandingPage() {
  const content = useQuery(api.content.getPublic);
  const s = content?.settings ?? FALLBACK.settings;
  const blocks = content?.blocks ?? FALLBACK.blocks;
  const get = (k: string) => s[k] ?? FALLBACK.settings[k] ?? "";

  return (
    <>
      <PublicNav />

      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="pill">{get("hero.pill")}</span>
              <h1 style={{ marginTop: 18 }}>
                {get("hero.headline1")}
                <br />
                <span className="grad">{get("hero.headline2")}</span>
              </h1>
              <p>{get("hero.subhead")}</p>
              <div className="hero-cta">
                <Link href="/signup" className="btn btn-primary">
                  {get("hero.ctaPrimary")}
                </Link>
                <a href="#how" className="btn btn-ghost">
                  {get("hero.ctaSecondary")}
                </a>
              </div>
              <div className="hero-stats">
                <div className="s">
                  <div className="n">{get("hero.stat1.n")}</div>
                  <div className="l">{get("hero.stat1.l")}</div>
                </div>
                <div className="s">
                  <div className="n">{get("hero.stat2.n")}</div>
                  <div className="l">{get("hero.stat2.l")}</div>
                </div>
                <div className="s">
                  <div className="n">{get("hero.stat3.n")}</div>
                  <div className="l">{get("hero.stat3.l")}</div>
                </div>
              </div>
            </div>
            <div className="hero-vis">
              <img src={get("hero.image")} alt="" />
              <div className="ov" />
              <div className="play" />
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="wrap">
          <div className="sec-h">
            <span className="pill">{get("features.pill")}</span>
            <h2>{get("features.heading")}</h2>
            <p>{get("features.sub")}</p>
          </div>
          <div className="f-grid">
            {blocks.features?.map((f, i) => (
              <div className="f-card" key={i}>
                {f.imageUrl ? <img src={f.imageUrl} alt="" /> : null}
                <div className="bd">
                  <div className={`f-ico ${f.iconColor ?? "a"}`}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="how">
        <div className="wrap">
          <div className="sec-h">
            <span className="pill">{get("steps.pill")}</span>
            <h2>{get("steps.heading")}</h2>
            <p>{get("steps.sub")}</p>
          </div>
          <div className="steps">
            {blocks.steps?.map((st, i) => (
              <div className="step" key={i}>
                <div className="sn">{st.number}</div>
                <h3>{st.title}</h3>
                <p>{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="usecases">
        <div className="wrap">
          <div className="sec-h">
            <span className="pill">{get("usecases.pill")}</span>
            <h2>{get("usecases.heading")}</h2>
          </div>
          <div className="uc-grid">
            {blocks.usecases?.map((u, i) => (
              <div className="uc" key={i}>
                {u.imageUrl ? <img src={u.imageUrl} alt="" /> : null}
                <div className="bd">
                  <h4>
                    {u.emoji} {u.title}
                  </h4>
                  <p>{u.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="band">
            {[1, 2, 3, 4].map((i) => (
              <div className="bs" key={i}>
                <div className="n">{get(`band.s${i}.n`)}</div>
                <div className="l">{get(`band.s${i}.l`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-h">
            <span className="pill">{get("testimonials.pill")}</span>
            <h2>{get("testimonials.heading")}</h2>
          </div>
          <div className="tg">
            {blocks.testimonials?.map((t, i) => (
              <div className="tcard" key={i}>
                <div className="stars">{"★".repeat(t.stars ?? 5)}</div>
                <p>&ldquo;{t.quote}&rdquo;</p>
                <div className="who">
                  {t.avatarUrl ? <img src={t.avatarUrl} alt="" /> : null}
                  <div>
                    <div className="nm">{t.name}</div>
                    <div className="rl">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="faq">
        <div className="wrap">
          <div className="sec-h">
            <h2>{get("faq.heading")}</h2>
          </div>
          <div className="faq">
            {blocks.faq?.map((q, i) => <FaqItem key={i} q={q.question} a={q.answer} defaultOpen={i === 0} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-final">
            <h2>{get("cta.heading")}</h2>
            <p>{get("cta.sub")}</p>
            <Link href="/signup" className="btn btn-primary">
              {get("cta.button")}
            </Link>
          </div>
        </div>
      </section>

      <Footer tagline={get("footer.tagline")} copyright={get("footer.copyright")} />
    </>
  );
}

function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`faq-item ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
      <div className="q">
        {q} <span className="pl">+</span>
      </div>
      <div className="a">{a}</div>
    </div>
  );
}
