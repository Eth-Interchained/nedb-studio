import { Router } from "express";

import { validateScaffold } from "../lib/types";
import * as nedb from "./nedb";

/**
 * /api/databases — thin proxy from the browser to the NEDB server (nedbd). The
 * studio adds no database logic; it derives a deploy payload from a scaffold and
 * forwards queries/writes to the daemon, which owns persistence and integrity.
 */
export const databases = Router();

function fail(res: import("express").Response, e: unknown): void {
  res.status(502).json({ error: e instanceof Error ? e.message : String(e) });
}

// Connection status (does the configured nedbd answer?).
databases.get("/status", async (_req, res) => {
  try {
    const h = await nedb.health();
    res.json({ connected: true, ...h });
  } catch (e) {
    res.json({ connected: false, error: e instanceof Error ? e.message : String(e) });
  }
});

databases.get("/", async (_req, res) => {
  try {
    res.json(await nedb.listDatabases());
  } catch (e) {
    fail(res, e);
  }
});

// Deploy: { scaffold } (studio derives init) OR { name, init } (raw passthrough).
databases.post("/", async (req, res) => {
  const body = req.body ?? {};
  try {
    if (body.scaffold) {
      const v = validateScaffold(body.scaffold);
      if (!v.ok || !v.scaffold) {
        res.status(400).json({ error: "invalid scaffold", details: v.errors ?? [] });
        return;
      }
      const out = await nedb.deployScaffold(body.name || v.scaffold.appName, v.scaffold);
      res.status(201).json(out);
      return;
    }
    if (body.name) {
      res.status(201).json(await nedb.createDatabase(nedb.slug(body.name), body.init));
      return;
    }
    res.status(400).json({ error: "scaffold or name is required" });
  } catch (e) {
    fail(res, e);
  }
});

databases.get("/:name", async (req, res) => {
  try {
    res.json(await nedb.getDatabase(req.params.name));
  } catch (e) {
    fail(res, e);
  }
});

databases.delete("/:name", async (req, res) => {
  try {
    res.json(await nedb.dropDatabase(req.params.name));
  } catch (e) {
    fail(res, e);
  }
});

databases.post("/:name/query", async (req, res) => {
  const nql = String(req.body?.nql ?? "").trim();
  if (!nql) {
    res.status(400).json({ error: "nql is required" });
    return;
  }
  try {
    res.json(await nedb.queryDatabase(req.params.name, nql));
  } catch (e) {
    fail(res, e);
  }
});

databases.post("/:name/rows", async (req, res) => {
  try {
    res.json(await nedb.putRow(req.params.name, req.body ?? {}));
  } catch (e) {
    fail(res, e);
  }
});

databases.get("/:name/verify", async (req, res) => {
  try {
    res.json(await nedb.verifyDatabase(req.params.name));
  } catch (e) {
    fail(res, e);
  }
});

databases.get("/:name/log", async (req, res) => {
  try {
    res.json(await nedb.logDatabase(req.params.name, Number(req.query.limit ?? 50)));
  } catch (e) {
    fail(res, e);
  }
});
