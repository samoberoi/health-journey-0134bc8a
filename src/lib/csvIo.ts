// Lightweight CSV parser/serializer + generic Supabase upsert-by-id importer.
// Handles quoted fields, embedded newlines, commas, and escaped quotes.

import { supabase } from "@/integrations/supabase/client";

export function parseCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === "") continue;
    const obj: Record<string, string> = {};
    header.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    out.push(obj);
  }
  return out;
}

/** Coerce CSV string cells into JS values suitable for JSON/PostgREST. */
export function coerceRow(row: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, raw] of Object.entries(row)) {
    if (raw === "" || raw == null) { out[k] = null; continue; }
    const s = String(raw);
    // JSON (arrays/objects/booleans/nulls/numbers)
    const t = s.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try { out[k] = JSON.parse(t); continue; } catch { /* fallthrough */ }
    }
    if (t === "true" || t === "false") { out[k] = t === "true"; continue; }
    if (t === "null") { out[k] = null; continue; }
    // Preserve leading-zero strings as strings; otherwise numeric
    if (/^-?\d+(\.\d+)?$/.test(t) && !(t.length > 1 && t.startsWith("0") && !t.startsWith("0."))) {
      const n = Number(t);
      if (Number.isFinite(n)) { out[k] = n; continue; }
    }
    out[k] = s;
  }
  return out;
}

export type ImportResult = { total: number; inserted: number; updated: number; failed: number; errors: string[] };

/**
 * Upsert rows by primary key (default `id`) into a Supabase table.
 * Rows without the pk get inserted (server assigns id).
 */
export async function importCsvToTable(
  tableName: string,
  csvText: string,
  opts: { pk?: string; batchSize?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<ImportResult> {
  const pk = opts.pk ?? "id";
  const batchSize = opts.batchSize ?? 200;
  const raw = parseCsv(csvText);
  const rows = raw.map(coerceRow);

  const result: ImportResult = { total: rows.length, inserted: 0, updated: 0, failed: 0, errors: [] };
  if (!rows.length) return result;

  const withId = rows.filter((r) => r[pk] != null && r[pk] !== "");
  const withoutId = rows.filter((r) => r[pk] == null || r[pk] === "");

  // Upsert rows that have a PK
  for (let i = 0; i < withId.length; i += batchSize) {
    const batch = withId.slice(i, i + batchSize);
    const { error, count } = await (supabase as any)
      .from(tableName)
      .upsert(batch, { onConflict: pk, count: "exact" });
    if (error) {
      result.failed += batch.length;
      result.errors.push(error.message);
    } else {
      result.updated += count ?? batch.length;
    }
    opts.onProgress?.(Math.min(i + batch.length, withId.length), rows.length);
  }
  // Insert rows without a PK
  for (let i = 0; i < withoutId.length; i += batchSize) {
    const batch = withoutId.slice(i, i + batchSize);
    const { error, count } = await (supabase as any).from(tableName).insert(batch, { count: "exact" });
    if (error) {
      result.failed += batch.length;
      result.errors.push(error.message);
    } else {
      result.inserted += count ?? batch.length;
    }
    opts.onProgress?.(withId.length + Math.min(i + batch.length, withoutId.length), rows.length);
  }
  return result;
}

/** Fetch all rows from a table (paged) and return them for export. */
export async function fetchAllRows(tableName: string, orderBy?: string): Promise<any[]> {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q: any = (supabase as any).from(tableName).select("*").range(from, from + pageSize - 1);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
