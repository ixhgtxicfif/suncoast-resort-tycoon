import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';
import { verifyToken } from './_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    token = (req.query.token as string) || '';
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { sessionId, entries } = body;

  if (!sessionId || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const blobName = `actions/${user.sub}/${sessionId}.json`;

  let existing: any[] = [];
  try {
    const { blobs } = await list({ prefix: blobName });
    if (blobs.length > 0) {
      const resp = await fetch(blobs[0].url);
      existing = await resp.json();
    }
  } catch { /* start fresh */ }

  const merged = [...existing, ...entries];

  await put(blobName, JSON.stringify(merged), {
    access: 'public',
    contentType: 'application/json',
  });

  return res.status(200).json({ ok: true, count: merged.length });
}
