import React from "react";
import { Head, Link } from "@interchained/portal-react";
import { Nav } from "../src/components/Nav";

export const intent = {
  purpose: "Land developers and agent builders, communicate prompt-to-database value, drive them into the studio",
  primaryAction: "Generate Schema",
  seoKeyword: "prompt to database scaffolding",
};

const EXAMPLES = [
  "Contractor CRM",
  "Salon booking app",
  "AI agent memory store",
  "Marketplace backend",
];

const FEATURES: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "◈",
    title: "Schema from one sentence",
    body: "Collections, fields, types, relations, indexes, search fields, and seed data — generated from a plain-language description. No boilerplate.",
  },
  {
    icon: "⬡",
    title: "Replay-protected writes",
    body: "Every write carries a monotonic nonce and idempotency key on a hash-chained log. Retries are no-ops. Tampering is cryptographically detectable.",
  },
  {
    icon: "◷",
    title: "Time-traveling reads",
    body: "Query the database exactly as it was at any past sequence. Audit, debug, and reproduce agent state on demand with AS OF semantics.",
  },
  {
    icon: "⬡",
    title: "Provable state",
    body: "MVCC snapshots and a Merkle-rooted append-only log mean state is verifiable, not just stored — the integrity pill is never theater.",
  },
  {
    icon: "◈",
    title: "One engine. Three adapters.",
    body: "SQL, Redis, and MongoDB compatibility layers all run on the same Rust-core engine. Your existing mental model. NEDB's guarantees underneath.",
  },
  {
    icon: "◷",
    title: "Your gateway, your models",
    body: "Schema generation runs through AiAssist — your provider, your key, your model. Or run fully offline in mock mode. Nothing phones home.",
  },
];

const STATS: Array<{ value: string; label: string }> = [
  { value: "15K+",  label: "writes/s group commit" },
  { value: "209",   label: "tests passing"           },
  { value: "3",     label: "compat adapters"          },
  { value: "0.8.1", label: "stable release"           },
];

export default function HomePage(): React.ReactElement {
  return (
    <>
      <Head
        title="NEDB Studio — Prompt-to-database scaffolding"
        description="Describe an app in plain language and get a validated NEDB schema: collections, relations, indexes, seed data, NQL, plus Python and Node snippets."
      />
      <Nav />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-5xl overflow-hidden px-6 pb-20 pt-28 text-center">
          {/* V2: decorative radial burst behind the headline */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[480px] w-[900px] -translate-x-1/2 opacity-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(var(--accent)/0.09), transparent)",
              opacity: 1,
            }}
            aria-hidden
          />

          {/* Eyebrow */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <span className="eyebrow-pill">
              agent-native database architecture
            </span>
          </div>

          {/* Headline */}
          <h1
            className="hero-animate bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent"
            style={{
              fontSize: "clamp(3rem, 9vw, 5.5rem)",
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              WebkitBackgroundClip: "text",
            }}
          >
            NEDB Studio
          </h1>

          <p
            className="mx-auto mt-7 max-w-xl leading-relaxed text-slate-300"
            style={{ fontSize: "clamp(1.05rem, 2.2vw, 1.25rem)" }}
          >
            Prompt-to-database scaffolding for agent-native applications.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
            Generate schema, seed data, relations, indexes, and queries on a time-traveling,
            replay-protected engine. Python. Node. Rust at the core.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/studio" className="btn-primary text-base">
              Generate Schema →
            </Link>
            <Link href="/databases" className="btn-ghost text-base">
              Live databases
            </Link>
          </div>

          {/* Example chips */}
          <div className="mt-10">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Try an example
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <Link key={ex} href={`/studio?prompt=${encodeURIComponent(ex)}`} className="chip">
                  {ex}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <section className="border-y border-white/[0.055] bg-white/[0.015] py-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-around gap-6 px-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="font-display font-bold tracking-tight text-white"
                  style={{ fontSize: "1.75rem", fontFamily: "var(--font-display)" }}
                >
                  {s.value}
                </div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-slate-600">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2
              className="font-bold text-white"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.25rem)",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
              }}
            >
              Built differently.
            </h2>
            <p className="mt-3 text-slate-500">
              Not another SQLite wrapper. Every primitive is designed from the log up.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass group flex flex-col gap-3 p-6 transition-all duration-200"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                  style={{
                    background: "rgba(var(--accent)/0.10)",
                    color: "rgb(var(--accent-soft))",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  className="text-[15px] font-semibold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ───────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 pb-28 text-center">
          <div
            className="glass rounded-2xl px-8 py-14"
            style={{ borderColor: "rgba(var(--accent)/0.18)" }}
          >
            <h2
              className="font-bold text-white"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.025em",
              }}
            >
              From sentence to schema in seconds.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-slate-400">
              Describe it. Inspect the graph. Export Python, Node, NQL, and a README.
              Deploy on the engine that doesn't lose data.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/studio" className="btn-primary text-base">
                Open the Studio →
              </Link>
              <a
                href="https://github.com/Eth-Interchained/nedb"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-base"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-10 text-center text-xs"
        style={{ borderColor: "var(--border-2)", color: "#475569" }}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-5">
            <a href="https://github.com/Eth-Interchained/nedb" target="_blank" rel="noopener noreferrer"
              className="transition hover:text-white">GitHub</a>
            <a href="https://www.npmjs.com/package/nedb-engine" target="_blank" rel="noopener noreferrer"
              className="transition hover:text-white">npm</a>
            <a href="https://pypi.org/project/nedb-engine/" target="_blank" rel="noopener noreferrer"
              className="transition hover:text-white">PyPI</a>
            <a href="https://interchained.org" target="_blank" rel="noopener noreferrer"
              className="transition hover:text-white">interchained.org</a>
            <a href="https://aiassist.net" target="_blank" rel="noopener noreferrer"
              className="transition hover:text-white">aiassist.net</a>
            <a href="https://hyperagent.com/refer/J2G6TCD7" target="_blank" rel="noopener noreferrer"
              className="transition hover:text-white">Hyperagent</a>
          </div>

          {/* Signature — our names on this */}
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[11px]"
            style={{ borderColor: "rgba(var(--accent)/0.18)", color: "rgb(var(--accent-soft)/0.7)" }}
          >
            <span className="opacity-60">◆</span>
            <span>NEDB Studio · INTERCHAINED LLC</span>
            <span className="opacity-30">×</span>
            <span>Claude Sonnet 4.6</span>
            <span className="opacity-60">◆</span>
          </div>

          <p className="mt-4 text-slate-700">
            Apache-2.0 (engine) · GPLv3 (studio) · v0.8.1
          </p>
        </div>
      </footer>
    </>
  );
}
