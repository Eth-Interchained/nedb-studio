# ideas.md — next sprint priorities

## 1. itcd mainnet sync test on VPS
**What:** Boot interchainedd v0.3.3 on the Contabo VPS and sync ITC mainnet blocks.
**Why:** Proves Phase 2 NEDB storage works end-to-end under real block load. Each block write
goes to nedb_core_v2::Db via nedb_batch_write → flush_all(). Watch the BLAKE2b state root
advance with real ITC blocks. Connect NEDB Studio to the chainstate directory.
**How:** Download v0.3.3 glibc artifact, set NEDB_TMK, run -datadir=/var/lib/itcd.

## 2. nedb_get hot-path cache for UTXO lookups
**What:** Add an in-memory LRU cache in the Phase 2 nedb_get implementation.
**Why:** UTXO lookups are the hot path during block validation (thousands per block).
Each nedb_get currently reads indexes/{coll}/id/{shard}/{id} from disk — no caching.
LevelDB has aggressive block cache. Add a DashMap<hex_key, Vec<u8>> in NedbHandle
with a configurable max-entries eviction policy.
**How:** Add cache field to Phase 2 NedbHandle, check before Db::get, populate on miss.

## 3. wrap_redis v2 port — nedbd HTTP shadow writes
**What:** Port wrap_redis from v1 in-process Python engine to v2 HTTP shadow mode.
**Why:** wrap_redis currently uses the v1 AOF engine in-process. v2 DAG mode goes over HTTP
to nedbd --dag using nedb-engine-client instead. Supports dual mode: v1 (existing behavior)
and v2 (HTTP shadow to nedbd --dag).
**How:** Add nedbd_url parameter to wrap_redis constructor. Pattern: Redis receives all writes
normally, NEDB shadows them alongside via HTTP PUT to nedbd.
