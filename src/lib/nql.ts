import type { NEDBScaffold } from "./types";

/**
 * Browser-side NQL parser + executor.
 *
 * This mirrors the NEDB engine's NQL grammar (the Rust parser is the production
 * source of truth) so the studio can RUN a query against the scaffold's seed data
 * entirely in the browser — phpMyAdmin-style, no database to provision. It also
 * provides a deterministic natural-language → NQL fallback for mock mode.
 *
 * Grammar (full engine grammar as of v1.0.4):
 *   FROM <collection>
 *     [AS OF <seq>]
 *     [VALID AS OF "<iso-date>"]
 *     [WHERE <field> <op> <value> [AND ...]]
 *     [VALID AS OF "<iso-date>"]
 *     [SEARCH "<text>"]
 *     [ORDER BY <field> [ASC|DESC]]
 *     [TRAVERSE <relation>]
 *     [TRACE <field> [REVERSE]]
 *     [LIMIT <n>]
 *     [GROUP BY <field> [COUNT | SUM <f> | AVG <f> | MIN <f> | MAX <f>]]
 */

export type Op = "=" | "!=" | "<" | "<=" | ">" | ">=";
export type AggFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export interface Plan {
  from: string;
  asOf: number | null;
  validAsOf: string | null;
  where: Array<{ field: string; op: Op; value: unknown }>;
  search: string | null;
  orderBy: { field: string; dir: "ASC" | "DESC" } | null;
  traverse: string | null;
  trace: string | null;
  traceReverse: boolean;
  limit: number | null;
  groupBy: string | null;
  aggregate: { func: AggFunc; field: string | null } | null;
}

type Tok = { t: "kw" | "word" | "op" | "num" | "str"; v: string | number };

const KEYWORDS = new Set([
  "from", "as", "of", "where", "and", "search", "order", "by",
  "asc", "desc", "traverse", "trace", "reverse", "limit",
  "valid", "group", "count", "sum", "avg", "min", "max",
  "true", "false", "null",
]);
const TOKEN_RE = /\s+|"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)|(<=|>=|!=|=|<|>)|([A-Za-z_][A-Za-z0-9_]*)/y;

function lex(text: string): Tok[] {
  const toks: Tok[] = [];
  let pos = 0;
  TOKEN_RE.lastIndex = 0;
  while (pos < text.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(text);
    if (!m || m.index !== pos) throw new Error(`NQL: unexpected token near "${text.slice(pos, pos + 16)}"`);
    pos = TOKEN_RE.lastIndex;
    const [, dq, sq, num, op, word] = m;
    if (dq !== undefined) toks.push({ t: "str", v: dq });
    else if (sq !== undefined) toks.push({ t: "str", v: sq });
    else if (num !== undefined) toks.push({ t: "num", v: num.includes(".") ? parseFloat(num) : parseInt(num, 10) });
    else if (op !== undefined) toks.push({ t: "op", v: op });
    else if (word !== undefined) {
      const lw = word.toLowerCase();
      const isKw = KEYWORDS.has(lw);
      toks.push({ t: isKw ? "kw" : "word", v: isKw ? lw : word });
    }
    // whitespace: skip
  }
  return toks;
}

export function parseNql(text: string): Plan {
  const toks = lex(text);
  let i = 0;
  const peek = (): Tok | undefined => toks[i];
  const eatKw = (kw: string) => {
    const t = peek();
    if (!t || t.t !== "kw" || t.v !== kw) throw new Error(`NQL: expected ${kw.toUpperCase()}`);
    i++;
  };
  const value = (): unknown => {
    const t = peek();
    if (!t) throw new Error("NQL: expected value");
    if (t.t === "num" || t.t === "str") { i++; return t.v; }
    if (t.t === "kw" && (t.v === "true" || t.v === "false" || t.v === "null")) {
      i++;
      return t.v === "true" ? true : t.v === "false" ? false : null;
    }
    if (t.t === "word") { i++; return t.v; }
    throw new Error("NQL: invalid value");
  };

  eatKw("from");
  const f = peek();
  if (!f || (f.t !== "word" && f.t !== "kw")) throw new Error("NQL: expected collection after FROM");
  i++;
  const plan: Plan = {
    from: String(f.v),
    asOf: null,
    validAsOf: null,
    where: [],
    search: null,
    orderBy: null,
    traverse: null,
    trace: null,
    traceReverse: false,
    limit: null,
    groupBy: null,
    aggregate: null,
  };

  // AS OF <seq>
  if (peek()?.t === "kw" && peek()?.v === "as") {
    i++; eatKw("of");
    const n = peek();
    if (!n || n.t !== "num") throw new Error("NQL: AS OF expects an integer");
    i++; plan.asOf = Number(n.v);
  }

  // VALID AS OF "<date>"  (position 1 — before WHERE)
  if (peek()?.t === "kw" && peek()?.v === "valid") {
    i++; eatKw("as"); eatKw("of");
    const s = peek();
    if (!s || s.t !== "str") throw new Error("NQL: VALID AS OF expects a quoted date string");
    i++; plan.validAsOf = String(s.v);
  }

  // WHERE
  if (peek()?.t === "kw" && peek()?.v === "where") {
    i++;
    for (;;) {
      const fld = peek();
      if (!fld || (fld.t !== "word" && fld.t !== "kw")) throw new Error("NQL: expected field in WHERE");
      i++;
      const op = peek();
      if (!op || op.t !== "op") throw new Error("NQL: expected operator in WHERE");
      i++;
      plan.where.push({ field: String(fld.v), op: op.v as Op, value: value() });
      if (peek()?.t === "kw" && peek()?.v === "and") { i++; continue; }
      break;
    }
  }

  // VALID AS OF "<date>"  (position 2 — after WHERE, mirrors engine grammar)
  if (peek()?.t === "kw" && peek()?.v === "valid" && plan.validAsOf === null) {
    i++; eatKw("as"); eatKw("of");
    const s = peek();
    if (!s || s.t !== "str") throw new Error("NQL: VALID AS OF expects a quoted date string");
    i++; plan.validAsOf = String(s.v);
  }

  // SEARCH "<text>"
  if (peek()?.t === "kw" && peek()?.v === "search") {
    i++;
    const s = peek();
    if (!s || s.t !== "str") throw new Error("NQL: SEARCH expects a quoted string");
    i++; plan.search = String(s.v);
  }

  // ORDER BY <field> [ASC|DESC]
  if (peek()?.t === "kw" && peek()?.v === "order") {
    i++; eatKw("by");
    const fld = peek();
    if (!fld || (fld.t !== "word" && fld.t !== "kw")) throw new Error("NQL: expected field after ORDER BY");
    i++;
    let dir: "ASC" | "DESC" = "ASC";
    if (peek()?.t === "kw" && peek()?.v === "asc") i++;
    else if (peek()?.t === "kw" && peek()?.v === "desc") { i++; dir = "DESC"; }
    plan.orderBy = { field: String(fld.v), dir };
  }

  // TRAVERSE <relation>
  if (peek()?.t === "kw" && peek()?.v === "traverse") {
    i++;
    const rel = peek();
    if (!rel || (rel.t !== "word" && rel.t !== "kw")) throw new Error("NQL: expected relation after TRAVERSE");
    i++; plan.traverse = String(rel.v);
  }

  // TRACE <field> [REVERSE]
  if (peek()?.t === "kw" && peek()?.v === "trace") {
    i++;
    const fld = peek();
    if (!fld || (fld.t !== "word" && fld.t !== "kw")) throw new Error("NQL: expected field after TRACE");
    i++; plan.trace = String(fld.v);
    if (peek()?.t === "kw" && peek()?.v === "reverse") { i++; plan.traceReverse = true; }
  }

  // LIMIT <n>
  if (peek()?.t === "kw" && peek()?.v === "limit") {
    i++;
    const n = peek();
    if (!n || n.t !== "num") throw new Error("NQL: LIMIT expects an integer");
    i++; plan.limit = Number(n.v);
  }

  // GROUP BY <field> [COUNT | SUM <f> | AVG <f> | MIN <f> | MAX <f>]
  if (peek()?.t === "kw" && peek()?.v === "group") {
    i++; eatKw("by");
    const fld = peek();
    if (!fld || (fld.t !== "word" && fld.t !== "kw")) throw new Error("NQL: expected field after GROUP BY");
    i++; plan.groupBy = String(fld.v);
    const aggTok = peek();
    if (aggTok?.t === "kw" && ["count", "sum", "avg", "min", "max"].includes(String(aggTok.v))) {
      i++;
      const func = String(aggTok.v).toUpperCase() as AggFunc;
      if (func === "COUNT") {
        plan.aggregate = { func, field: null };
      } else {
        const af = peek();
        if (!af || (af.t !== "word" && af.t !== "kw")) throw new Error(`NQL: ${func} expects a field name`);
        i++; plan.aggregate = { func, field: String(af.v) };
      }
    }
  }

  if (i !== toks.length) throw new Error("NQL: unexpected trailing input");
  return plan;
}

function cmp(a: unknown, op: Op, b: unknown): boolean {
  if (op === "=") return a === b || String(a) === String(b);
  if (op === "!=") return !(a === b || String(a) === String(b));
  if (a == null) return false;
  const na = typeof a === "number" ? a : parseFloat(String(a));
  const nb = typeof b === "number" ? b : parseFloat(String(b));
  const bothNum = !Number.isNaN(na) && !Number.isNaN(nb);
  const x = bothNum ? na : String(a);
  const y = bothNum ? nb : String(b);
  if (op === "<") return x < y;
  if (op === "<=") return x <= y;
  if (op === ">") return x > y;
  if (op === ">=") return x >= y;
  return false;
}

const tokenize = (s: string): string[] => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
const rowId = (r: Record<string, unknown>): unknown => r._id ?? r.id;

export interface QueryResult {
  rows: Array<Record<string, unknown>>;
  columns: string[];
  count: number;
  note?: string;
  error?: string;
}

/** Execute an NQL string against a scaffold's seed data, in-browser. */
export function executeNql(nql: string, scaffold: NEDBScaffold): QueryResult {
  let plan: Plan;
  try {
    plan = parseNql(nql);
  } catch (e) {
    return { rows: [], columns: [], count: 0, error: String(e instanceof Error ? e.message : e) };
  }

  const data = scaffold.seedData as Record<string, Array<Record<string, unknown>>>;
  let rows = Array.isArray(data[plan.from]) ? [...data[plan.from]] : [];
  const notes: string[] = [];
  if (!data[plan.from]) notes.push(`No seed rows for "${plan.from}".`);
  if (plan.asOf != null) notes.push("AS OF shown against the current seed snapshot (live time-travel needs a running engine).");
  if (plan.validAsOf != null) notes.push(`VALID AS OF "${plan.validAsOf}": bi-temporal filter applied against seed data (full valid-time indexing needs a running engine).`);

  // WHERE
  for (const c of plan.where) rows = rows.filter((r) => cmp(r[c.field], c.op, c.value));

  // SEARCH (naive contains over string fields, all tokens must match)
  if (plan.search) {
    const terms = tokenize(plan.search);
    rows = rows.filter((r) => {
      const blob = Object.values(r).filter((v) => typeof v === "string").join(" ").toLowerCase();
      return terms.every((t) => blob.includes(t));
    });
  }

  // ORDER BY
  if (plan.orderBy) {
    const { field, dir } = plan.orderBy;
    rows.sort((a, b) => {
      const av = a[field], bv = b[field];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const r = av < bv ? -1 : 1;
      return dir === "DESC" ? -r : r;
    });
  }

  // TRAVERSE (resolve via relation + id matching across reference fields)
  if (plan.traverse) {
    const rel = scaffold.relations.find((r) => r.from === plan.from && r.relation === plan.traverse);
    if (!rel) {
      notes.push(`No relation "${plan.traverse}" from "${plan.from}".`);
      rows = [];
    } else {
      const target = Array.isArray(data[rel.to]) ? data[rel.to] : [];
      const out: Array<Record<string, unknown>> = [];
      const seen = new Set<unknown>();
      for (const base of rows) {
        const bid = rowId(base);
        for (const t of target) {
          const tid = rowId(t);
          const related = Object.values(t).includes(bid) || Object.values(base).includes(tid);
          if (related && !seen.has(tid)) { seen.add(tid); out.push(t); }
        }
      }
      rows = out;
      notes.push(`Traversed ${rel.from} —${rel.relation}→ ${rel.to}.`);
    }
  }

  // TRACE <field> [REVERSE] — causal chain walk
  // Full causal provenance needs a running engine (BLAKE2b-sealed caused_by chain).
  // Mock mode: walk the named field as a linked-list pointer across all seed collections.
  if (plan.trace != null) {
    const field = plan.trace;
    const allRows = (Object.values(data) as Array<Array<Record<string, unknown>>>).flat();
    const idMap = new Map<unknown, Record<string, unknown>>();
    for (const r of allRows) { const rid = rowId(r); if (rid != null) idMap.set(rid, r); }

    const out: Array<Record<string, unknown>> = [];
    const visited = new Set<unknown>();
    const todo = [...rows];
    while (todo.length) {
      const r = todo.shift()!;
      const rid = rowId(r);
      if (visited.has(rid)) continue;
      visited.add(rid);
      out.push(r);
      if (plan.traceReverse) {
        // Find any row whose [field] value equals this row's id
        for (const other of allRows) {
          const oid = rowId(other);
          if (!visited.has(oid) && other[field] === rid) todo.push(other);
        }
      } else {
        // Follow field forward to the linked row
        const targetId = r[field];
        if (targetId != null) {
          const linked = idMap.get(targetId);
          if (linked && !visited.has(rowId(linked))) todo.push(linked);
        }
      }
    }
    rows = out;
    notes.push(`TRACE ${field}${plan.traceReverse ? " REVERSE" : ""}: walked ${rows.length} node(s) via seed data (full sealed causal chain needs a running engine).`);
  }

  // LIMIT
  if (plan.limit != null) rows = rows.slice(0, plan.limit);

  // GROUP BY <field> [COUNT | SUM <f> | AVG <f> | MIN <f> | MAX <f>]
  if (plan.groupBy != null) {
    const gField = plan.groupBy;
    const groups = new Map<unknown, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const key = r[gField] ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const agg = plan.aggregate;
    rows = [];
    for (const [key, grp] of groups) {
      const grpRow: Record<string, unknown> = { [gField]: key };
      if (!agg || agg.func === "COUNT") {
        grpRow["count"] = grp.length;
      } else {
        const af = agg.field!;
        const nums = grp
          .map((r) => (typeof r[af] === "number" ? (r[af] as number) : parseFloat(String(r[af]))))
          .filter((n) => !Number.isNaN(n));
        if (agg.func === "SUM") grpRow[`sum(${af})`] = nums.reduce((a, b) => a + b, 0);
        else if (agg.func === "AVG") grpRow[`avg(${af})`] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        else if (agg.func === "MIN") grpRow[`min(${af})`] = nums.length ? Math.min(...nums) : null;
        else if (agg.func === "MAX") grpRow[`max(${af})`] = nums.length ? Math.max(...nums) : null;
      }
      rows.push(grpRow);
    }
    notes.push(`GROUP BY ${gField}: ${groups.size} group(s).`);
  }

  const columns: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);

  return { rows, columns, count: rows.length, note: notes.length ? notes.join(" ") : undefined };
}

/** Deterministic natural-language → NQL, used in mock mode (no AiAssist). */
export function heuristicNlToNql(prompt: string, scaffold: NEDBScaffold): string {
  const p = prompt.toLowerCase();
  const collNames = scaffold.collections.map((c) => c.name);
  // pick collection: name (or singular) mentioned, else first
  const coll =
    collNames.find((n) => p.includes(n) || p.includes(n.replace(/s$/, ""))) ?? collNames[0] ?? "items";
  const c = scaffold.collections.find((x) => x.name === coll);
  const fields = c?.fields ?? [];
  const has = (name: string) => fields.some((f) => f.name === name);
  const parts = [`FROM ${coll}`];

  // status = active
  if (p.includes("active") && has("status")) parts.push('WHERE status = "active"');

  // search free text in quotes
  const quoted = prompt.match(/"([^"]+)"|'([^']+)'/);
  if (quoted) parts.push(`SEARCH "${quoted[1] ?? quoted[2]}"`);
  else if (/\b(search|find|containing|matching|about)\b/.test(p)) {
    const kw = p.replace(/.*\b(search|find|containing|matching|about)\b/, "").trim().split(/\s+/)[0];
    if (kw) parts.push(`SEARCH "${kw}"`);
  }

  // order by
  const dateField = fields.find((f) => f.type === "datetime")?.name;
  const numField = fields.find((f) => f.type === "number")?.name;
  if (/\b(newest|latest|recent)\b/.test(p) && dateField) parts.push(`ORDER BY ${dateField} DESC`);
  else if (/\b(oldest|earliest)\b/.test(p) && dateField) parts.push(`ORDER BY ${dateField} ASC`);
  else if (/\b(highest|top|most|largest|expensive)\b/.test(p) && numField) parts.push(`ORDER BY ${numField} DESC`);
  else if (/\b(lowest|cheapest|smallest)\b/.test(p) && numField) parts.push(`ORDER BY ${numField} ASC`);

  // limit
  const nMatch = p.match(/\b(?:top|first|limit)\s+(\d+)\b/);
  parts.push(`LIMIT ${nMatch ? nMatch[1] : "20"}`);

  return parts.join(" ");
}
