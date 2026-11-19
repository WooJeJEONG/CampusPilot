/* Campuspilot — change password. The current password is now verified
   server-side (the client no longer holds the password list at all), so
   My Profile's "Change Password" flow sends {unid, currentPassword,
   newPassword} and this checks currentPassword against the DB itself. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureTables, sql, sendJson, requestBody, isValidUnid } from '../_db';

export const config = { runtime: 'nodejs' };

type JsonRequest = IncomingMessage & { body?: unknown; method?: string };

export default async function handler(req: JsonRequest, res: ServerResponse) {
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return; }
  try {
    await ensureTables();
    const body = requestBody(req) as { unid?: unknown; currentPassword?: unknown; newPassword?: unknown };
    const unid = String(body.unid || '').trim().toLowerCase();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!isValidUnid(unid)) { sendJson(res, 400, { ok: false, error: 'Account not found.' }); return; }
    if (newPassword.length < 6) { sendJson(res, 400, { ok: false, error: 'New password must be at least 6 characters.' }); return; }

    const existing = await sql`SELECT password FROM accounts WHERE unid = ${unid}`;
    const row = existing.rows[0] as any;
    if (!row) { sendJson(res, 404, { ok: false, error: "Couldn't find your account — try signing in again." }); return; }
    if (row.password !== currentPassword) { sendJson(res, 401, { ok: false, error: 'Current password is incorrect.' }); return; }

    await sql`UPDATE accounts SET password = ${newPassword} WHERE unid = ${unid}`;
    sendJson(res, 200, { ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error.';
    sendJson(res, 500, { ok: false, error: message });
  }
}
