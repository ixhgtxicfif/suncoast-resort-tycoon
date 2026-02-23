import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list, del } from '@vercel/blob';
import { createHmac } from 'crypto';

interface UserPayload { sub: string; email: string; name: string; picture: string; }

function verifyToken(token: string): UserPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
    if (s !== expected) return null;
    const data = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: data.sub, email: data.email, name: data.name, picture: data.picture };
  } catch { return null; }
}

interface LeaderboardEntry {
  name: string;
  email: string;
  picture: string;
  userId: string;
  reputation: number;
  stars: number;
  day: number;
  netIncome: number;
  totalEarned: number;
  buildings: number;
  timestamp: number;
}

const BLOB_NAME = 'suncoast-leaderboard.json';
const MAX_ENTRIES = 50;

function sanitize(str: string): string {
  return str.replace(/[<>&"']/g, '').trim().slice(0, 20);
}

async function loadEntries(): Promise<LeaderboardEntry[]> {
  try {
    const { blobs } = await list({ prefix: BLOB_NAME });
    if (blobs.length === 0) return [];
    const resp = await fetch(blobs[0].url);
    return await resp.json();
  } catch {
    return [];
  }
}

async function saveEntries(entries: LeaderboardEntry[]): Promise<void> {
  const { blobs } = await list({ prefix: BLOB_NAME });
  for (const blob of blobs) {
    await del(blob.url);
  }
  await put(BLOB_NAME, JSON.stringify(entries), {
    access: 'public',
    contentType: 'application/json',
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const entries = await loadEntries();
    const sorted = entries
      .sort((a, b) => b.reputation - a.reputation || b.totalEarned - a.totalEarned)
      .slice(0, MAX_ENTRIES);
    const publicEntries = sorted.map(({ userId: _, ...rest }) => rest);
    return res.status(200).json(publicEntries);
  }

  if (req.method === 'POST') {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await verifyToken(auth.slice(7));
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (typeof body.reputation !== 'number' || body.reputation < 0 || body.reputation > 100 ||
        typeof body.stars !== 'number' || body.stars < 1 || body.stars > 5 ||
        typeof body.day !== 'number' || body.day <= 0 ||
        typeof body.netIncome !== 'number' ||
        typeof body.totalEarned !== 'number' ||
        typeof body.buildings !== 'number') {
      return res.status(400).json({ error: 'Invalid entry data' });
    }

    const entry: LeaderboardEntry = {
      name: sanitize(user.name),
      email: user.email,
      picture: user.picture,
      userId: user.sub,
      reputation: Math.round(body.reputation),
      stars: Math.round(body.stars),
      day: Math.round(body.day),
      netIncome: Math.round(body.netIncome),
      totalEarned: Math.round(body.totalEarned),
      buildings: Math.round(body.buildings),
      timestamp: Date.now(),
    };

    let entries = await loadEntries();

    const existing = entries.findIndex(e => e.userId === entry.userId);
    if (existing >= 0) {
      if (entry.reputation > entries[existing].reputation ||
          (entry.reputation === entries[existing].reputation && entry.totalEarned > entries[existing].totalEarned)) {
        entries[existing] = entry;
      }
    } else {
      entries.push(entry);
    }

    entries.sort((a, b) => b.reputation - a.reputation || b.totalEarned - a.totalEarned);
    entries = entries.slice(0, MAX_ENTRIES);

    await saveEntries(entries);

    return res.status(200).json({ ok: true, rank: entries.findIndex(e => e.userId === entry.userId) + 1 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
