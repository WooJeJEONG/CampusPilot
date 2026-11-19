/* Campuspilot — admin roster: every self-registered student account,
   from any device, passwords never included in the response. Used by
   My Profile's admin student roster, Home's admin "Total Students" stat,
   and GradePilot's admin "Majors Among Registered Students" chart. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureTables, sql, sendJson } from '../_db';

export const config = { runtime: 'nodejs' };

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  if (req.method !== 'GET') { sendJson(res, 405, { error: 'Method not allowed.' }); return; }
  try {
    await ensureTables();
    const result = await sql`SELECT unid, name, major, major2, joined_at FROM accounts ORDER BY joined_at ASC`;
    const accounts = (result.rows as any[]).map((row) => ({
      unid: row.unid, name: row.name, major: row.major, major2: row.major2, joinedAt: Number(row.joined_at)
    }));
    sendJson(res, 200, { accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error.';
    sendJson(res, 500, { error: message, accounts: [] });
  }
}
