import { getConfig, type NedbConfig } from "./config";
import type { NEDBScaffold } from "../lib/types";

/**
 * Client for the NEDB server daemon (nedbd). The studio talks to a running NEDB
 * over HTTP — it does not embed or persist the engine itself. All database
 * responsibilities (log, MVCC, time-travel, integrity, durability) live in nedbd.
 */

type Json = Record<string, unknown>;

function headers(cfg: NedbConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
  };
}

async function call(path: string, init?: RequestInit): Promise<Json> {
  const cfg = getConfig();
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, { ...init, headers: { ...headers(cfg), ...(init?.headers || {}) } });
  } catch (e) {
    throw new Error(`cannot reach nedbd at ${cfg.url} — is the daemon running? (${(e as Error).message})`);
  }
  const text = await res.text();
  let data: Json = {};
  try {
    data = text ? (JSON.parse(text) as Json) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new Error((data.error as string) || `nedbd ${res.status}`);
  return data;
}

/** Ping a connection (current config, or an explicit url/token to test). */
export async function health(url?: string, token?: string): Promise<Json> {
  const cfg = getConfig();
  const target = url || cfg.url;
  const tok = token ?? cfg.token;
  const res = await fetch(`${target}/health`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
  if (!res.ok) throw new Error(`nedbd ${res.status}`);
  return (await res.json()) as Json;
}

export const listDatabases = () => call("/v1/databases");
export const getDatabase = (name: string) => call(`/v1/databases/${encodeURIComponent(name)}`);
export const dropDatabase = (name: string) => call(`/v1/databases/${encodeURIComponent(name)}`, { method: "DELETE" });
export const queryDatabase = (name: string, nql: string) =>
  call(`/v1/databases/${encodeURIComponent(name)}/query`, { method: "POST", body: JSON.stringify({ nql }) });
export const putRow = (name: string, body: Json) =>
  call(`/v1/databases/${encodeURIComponent(name)}/put`, { method: "POST", body: JSON.stringify(body) });
export const verifyDatabase = (name: string) => call(`/v1/databases/${encodeURIComponent(name)}/verify`);
export const logDatabase = (name: string, limit = 50) =>
  call(`/v1/databases/${encodeURIComponent(name)}/log?limit=${limit}`);

export function slug(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "db";
}

export async function createDatabase(name: string, init?: Json): Promise<Json> {
  return call("/v1/databases", { method: "POST", body: JSON.stringify({ name, init }) });
}

const rid = (doc: Record<string, unknown>, coll: string, i: number): string =>
  String(doc._id ?? doc.id ?? `${coll}-${i + 1}`);

/**
 * Translate a studio scaffold into a generic nedbd init payload: index specs,
 * seed docs per collection, and explicit graph links derived from reference
 * fields (so TRAVERSE works on the deployed database). nedbd stays schema-agnostic.
 */
export function deriveInit(s: NEDBScaffold): Json {
  const indexes = s.indexes.map((i) => [i.collection, i.field, i.kind]);
  const seed: Record<string, unknown[]> = {};
  const ids: Record<string, Set<string>> = {};
  for (const c of s.collections) {
    const rows = (s.seedData[c.name] as Record<string, unknown>[] | undefined) ?? [];
    seed[c.name] = rows;
    ids[c.name] = new Set(rows.map((r, i) => rid(r, c.name, i)));
  }
  const refFields = (coll: string) =>
    (s.collections.find((c) => c.name === coll)?.fields ?? []).filter((f) => f.type === "reference");

  const links: string[][] = [];
  const seen = new Set<string>();
  const add = (frm: string, rel: string, to: string) => {
    const k = `${frm}|${rel}|${to}`;
    if (!seen.has(k)) { seen.add(k); links.push([frm, rel, to]); }
  };
  for (const rel of s.relations) {
    const fromRows = (seed[rel.from] as Record<string, unknown>[]) ?? [];
    const toRows = (seed[rel.to] as Record<string, unknown>[]) ?? [];
    // FK on the "from" side pointing into "to"
    fromRows.forEach((r, i) => {
      for (const f of refFields(rel.from)) {
        const v = r[f.name];
        if (v != null && ids[rel.to]?.has(String(v))) add(`${rel.from}:${rid(r, rel.from, i)}`, rel.relation, `${rel.to}:${v}`);
      }
    });
    // FK on the "to" side pointing back into "from"
    toRows.forEach((r, i) => {
      for (const f of refFields(rel.to)) {
        const v = r[f.name];
        if (v != null && ids[rel.from]?.has(String(v))) add(`${rel.from}:${v}`, rel.relation, `${rel.to}:${rid(r, rel.to, i)}`);
      }
    });
  }
  return { indexes, seed, links };
}

/** Deploy a scaffold as a new nedbd database; auto-suffix the name on conflict. */
export async function deployScaffold(name: string, scaffold: NEDBScaffold): Promise<Json> {
  const init = deriveInit(scaffold);
  let candidate = slug(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await call("/v1/databases", { method: "POST", body: JSON.stringify({ name: candidate, init }) });
    } catch (e) {
      if (/already exists/i.test((e as Error).message) && attempt < 4) {
        candidate = `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      throw e;
    }
  }
  throw new Error("could not allocate a unique database name");
}
