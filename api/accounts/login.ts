/* Campuspilot — student sign-in. Verifies against the server's accounts
   table (not a per-browser copy), so the same account works no matter
   which device a student signs in from. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureTables, sql, sendJson, requestBody, isValidUnid } from '../_db';

export const config = { runtime: 'nodejs' };

type JsonRequest = IncomingMessage & { body?: unknown; method?: string };

export default async function handler(req: JsonRequest, res: ServerResponse) {
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return; }
  try {
    await ensureTables();
    const body = requestBody(req) as { unid?: unknown; password?: unknown };
    const unid = String(body.unid || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!isValidUnid(unid)) {
      sendJson(res, 400, { ok: false, error: 'UNID must be "u" followed by 7 digits, e.g. u1621896.' });
      return;
    }

    const result = await sql`SELECT unid, password, name, major, major2, joined_at FROM accounts WHERE unid = ${unid}`;
    const row = result.rows[0] as any;
    if (!row || row.password !== password) {
      sendJson(res, 401, { ok: false, error: 'Incorrect UNID or password.' });
      return;
    }
    sendJson(res, 200, { ok: true, account: { unid: row.unid, name: row.name, major: row.major, major2: row.major2, joinedAt: Number(row.joined_at) } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error.';
    sendJson(res, 500, { ok: false, error: message });
  }
}
