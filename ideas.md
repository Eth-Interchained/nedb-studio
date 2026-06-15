# NEDB Maintainer — Ideas for Next Turn

*Updated: 2026-06-15*

---

**Idea 1 — Files API proxy in Studio**
Expose nedbd's file storage API (`POST /databases/<name>/files`, `GET /databases/<name>/files/<filename>`, `GET /databases/<name>/files/<filename>/root`) through the Studio Express server by adding three routes to `databases.ts` and matching client helpers in `nedb.ts`; add a Files tab in the Databases page with upload, download, and Merkle root display. The engine has had versioned Cascade-compressed file storage since v0.7.x, but Studio has zero proxy coverage — a complete gap that blocks the on-chain anchoring story (Merkle root → ITC/BSC).

**Idea 2 — Checkpoint button in Database detail view**
Add `POST /:name/checkpoint` to `databases.ts` (proxies nedbd `POST /v1/databases/:name/checkpoint`) and a Checkpoint button in the Database detail panel that calls it and shows a toast with the returned `head` hash and `seq`. This is the only nedbd mutation route with zero proxy coverage in the Studio, and it's a one-line backend change paired with a small UI addition — high leverage, low risk.

**Idea 3 — Reconcile engine pyproject.toml license metadata**
The engine's top-level `LICENSE` file was changed to Business Source License (BSL) in PR #1, but `pyproject.toml` still declares `license = { text = "Apache-2.0" }` and the `License :: OSI Approved :: Apache Software License` PyPI trove classifier — this metadata is visible to every `pip install nedb-engine` consumer and package index. Fix: update `pyproject.toml` to `license = { text = "BSL-1.1" }` (or a plain `"BUSL-1.1"` text field), remove the Apache classifier, and add a `Intended Audience` note; bump to v1.0.5 patch. No functional change, but correct public metadata prevents license confusion.
