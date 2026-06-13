import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * NEDB connection configuration. Best-practice, env-first (12-factor): the studio
 * is a CLIENT of a running NEDB server (nedbd) and connects over a URL. NEDB_URL
 * is the baseline; the Settings panel can override it at runtime (persisted to a
 * small JSON file). The studio holds no database state of its own.
 */

export interface NedbConfig {
  url: string;
  token?: string;
}

const CONFIG_FILE = resolve(process.cwd(), process.env.NEDB_STUDIO_CONFIG ?? ".nedb-studio.json");
const DEFAULT_URL = "http://127.0.0.1:7070";

export function envConfig(): NedbConfig {
  return { url: process.env.NEDB_URL || DEFAULT_URL, token: process.env.NEDBD_TOKEN || undefined };
}

function readOverride(): Partial<NedbConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<NedbConfig>;
  } catch {
    return {};
  }
}

/** Effective connection: persisted override wins, else env, else default. */
export function getConfig(): NedbConfig {
  const env = envConfig();
  const ov = readOverride();
  return { url: ov.url || env.url, token: ov.token ?? env.token };
}

export function hasOverride(): boolean {
  return existsSync(CONFIG_FILE) && Object.keys(readOverride()).length > 0;
}

/** Persist a runtime override (from the Settings panel). Empty token is cleared. */
export function saveOverride(patch: Partial<NedbConfig>): NedbConfig {
  const next: Partial<NedbConfig> = { ...readOverride(), ...patch };
  if (!next.token) delete next.token;
  if (!next.url) delete next.url;
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return getConfig();
}
