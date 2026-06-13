import { Router } from "express";

import { envConfig, getConfig, hasOverride, saveOverride } from "./config";
import { health } from "./nedb";
import { defaults, hasCredentials } from "./aiassist";

/**
 * /api/settings — the studio's configuration surface. Connection (NEDB_URL +
 * optional token) is env-first with a runtime override; this also reports the
 * AiAssist gateway status and exposes intricate UI preferences.
 */
export const settings = Router();

// token is never echoed back in full — only whether one is set.
function redact(cfg: { url: string; token?: string }) {
  return { url: cfg.url, hasToken: Boolean(cfg.token) };
}

settings.get("/", async (_req, res) => {
  const effective = getConfig();
  const ai = defaults();
  let connection: Record<string, unknown> = { connected: false };
  try {
    connection = { connected: true, ...(await health()) };
  } catch (e) {
    connection = { connected: false, error: e instanceof Error ? e.message : String(e) };
  }
  res.json({
    nedb: {
      effective: redact(effective),
      env: redact(envConfig()),
      overridden: hasOverride(),
    },
    connection,
    aiassist: {
      mode: hasCredentials() ? "live" : "not configured",
      defaultProvider: ai.provider,
      defaultModel: ai.model,
    },
  });
});

// Test an explicit URL/token (or the current config) without saving.
settings.post("/test", async (req, res) => {
  const { url, token } = req.body ?? {};
  try {
    const h = await health(url ? String(url) : undefined, token ? String(token) : undefined);
    res.json({ connected: true, ...h });
  } catch (e) {
    res.json({ connected: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Persist a connection override (Settings panel "Save").
settings.put("/", (req, res) => {
  const patch: { url?: string; token?: string } = {};
  if (typeof req.body?.url === "string") patch.url = req.body.url.trim();
  if (typeof req.body?.token === "string") patch.token = req.body.token;
  const next = saveOverride(patch);
  res.json({ saved: true, nedb: redact(next) });
});
