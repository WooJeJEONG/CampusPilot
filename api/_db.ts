/* Campuspilot — shared Postgres helpers for every api/ route below.
   Uses Vercel Postgres (Storage -> Create Database -> Postgres in the
   Vercel dashboard), which injects POSTGRES_URL and friends into this
   project's env automatically once connected -- no connection string
   needs to be copied in by hand. ensureTables() is idempotent (CREATE
   TABLE IF NOT EXISTS) and cheap, so every handler just calls it first
   instead of relying on a separate one-time migration step. */
import { sql } from '@vercel/postgres';

let ensured = false;

export async function ensureTables(): Promise<void> {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS accounts (
    unid TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    major TEXT DEFAULT '',
    major2 TEXT DEFAULT '',
    joined_at BIGINT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  ensured = true;
}

export { sql };

export function sendJson(res: any, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function requestBody(req: any): any {
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

/* "u" + exactly 7 digits, e.g. u1621896 -- enforced server-side too (not
   just in the signup form) since the server is now the source of truth
   for who's a real registered student. */
export const UNID_PATTERN = /^u\d{7}$/i;
export function isValidUnid(unid: unknown): boolean {
  return typeof unid === 'string' && UNID_PATTERN.test(unid.trim());
}
