// An in-memory stand-in for the PostgREST query builder, faithful to exactly
// the operations src/server/devicePairing.js and agentPresence.js use.
export const db = {
  agent_spaces: [],
  agent_pairing_codes: [],
  agent_device_tokens: [],
  public_profiles: [],
};
export function reset() { for (const k of Object.keys(db)) db[k] = []; }

const match = (row, f) =>
  f.every(({ op, col, val }) =>
    op === "eq" ? row[col] === val
    : op === "is" ? (val === null ? row[col] == null : row[col] === val)
    : op === "lt" ? String(row[col]) < String(val)
    : true);

function builder(table) {
  const filters = [];
  let mode = "select", payload = null, selectCols = "", order = null;
  const rowsNow = () => db[table].filter((r) => match(r, filters));

  const expand = (r) => {
    if (!selectCols.includes("agent_spaces (")) return r;
    return { ...r, agent_spaces: db.agent_spaces.find((s) => s.id === r.space_id) || null };
  };

  async function run() {
    if (mode === "insert") {
      const row = { id: `${table}-${db[table].length + 1}-${Math.random().toString(36).slice(2, 7)}`, ...payload };
      db[table].push(row);
      return { data: [row], error: null };
    }
    if (mode === "update") {
      const hits = rowsNow();
      hits.forEach((r) => Object.assign(r, payload));
      return { data: hits, error: null };
    }
    if (mode === "delete") {
      const hits = rowsNow();
      db[table] = db[table].filter((r) => !hits.includes(r));
      return { data: hits, error: null };
    }
    let rows = rowsNow().map(expand);
    if (order) rows = rows.slice().sort((a, b) =>
      order.asc ? String(a[order.col]).localeCompare(String(b[order.col]))
                : String(b[order.col]).localeCompare(String(a[order.col])));
    return { data: rows, error: null };
  }

  const api = {
    select(cols) { selectCols = cols || ""; return api; },
    insert(v) { mode = "insert"; payload = v; return api; },
    update(v) { mode = "update"; payload = v; return api; },
    delete() { mode = "delete"; return api; },
    eq(col, val) { filters.push({ op: "eq", col, val }); return api; },
    is(col, val) { filters.push({ op: "is", col, val }); return api; },
    lt(col, val) { filters.push({ op: "lt", col, val }); return api; },
    order(col, o) { order = { col, asc: o?.ascending !== false }; return api; },
    async maybeSingle() { const { data, error } = await run(); return { data: data[0] || null, error }; },
    async single() {
      const { data, error } = await run();
      return data.length ? { data: data[0], error } : { data: null, error: { message: "no rows", code: "PGRST116" } };
    },
    then(res, rej) { return run().then(res, rej); },
  };
  return api;
}

export function getSupabaseAdmin() { return { from: (t) => builder(t) }; }
