/* Campuspilot — My Profile's "Edit Major" flow: set/change major (+
   optional double-major/minor label) on an already-registered account. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureTables, sql, sendJson, requestBody, isValidUnid } from '../_db';

export const config = { runtime: 'nodejs' };

type JsonRequest = IncomingMessage & { body?: unknown; method?: string };

export default async function handler(req: JsonRequest, res: ServerResponse) {
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return; }
  try {
    await ensureTables();
    const body = requestBody(req) as { unid?: unknown; major?: unknown; major2?: unknown };
    const unid = String(body.unid || '').trim().toLowerCase();
    const major = String(body.major || '').trim();
    const major2 = String(body.major2 || '').trim();

    if (!isValidUnid(unid)) { sendJson(res, 400, { ok: false, error: 'Account not found.' }); return; }

    const result = await sql`UPDATE accounts SET major = ${major}, major2 = ${major2} WHERE unid = ${unid}
      RETURNING unid, name, major, major2, joined_at`;
    const row = result.rows[0] as any;
    if (!row) { sendJson(res, 404, { ok: false, error: "Couldn't find your account — try signing in again." }); return; }
    sendJson(res, 200, { ok: true, account: { unid: row.unid, name: row.name, major: row.major, major2: row.major2, joinedAt: Number(row.joined_at) } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error.';
    sendJson(res, 500, { ok: false, error: message });
  }
}
