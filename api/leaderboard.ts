import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list, del } from '@vercel/blob';

interface LeaderboardEntry {
  name: string;
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

function validate(entry: any): entry is LeaderboardEntry {
  return (
    typeof entry.name === 'string' && entry.name.trim().length > 0 &&
    typeof entry.reputation === 'number' && entry.reputation >= 0 && entry.reputation <= 100 &&
    typeof entry.stars === 'number' && entry.stars >= 1 && entry.stars <= 5 &&
    typeof entry.day === 'number' && entry.day > 0 && entry.day < 100000 &&
    typeof entry.netIncome === 'number' &&
    typeof entry.totalEarned === 'number' &&
    typeof entry.buildings === 'number' && entry.buildings >= 0
  );
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
  // Clean up old blobs
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const entries = await loadEntries();
    const sorted = entries
      .sort((a, b) => b.reputation - a.reputation || b.totalEarned - a.totalEarned)
      .slice(0, MAX_ENTRIES);
    return res.status(200).json(sorted);
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!validate(body)) {
      return res.status(400).json({ error: 'Invalid entry data' });
    }

    const entry: LeaderboardEntry = {
      name: sanitize(body.name),
      reputation: Math.round(body.reputation),
      stars: Math.round(body.stars),
      day: Math.round(body.day),
      netIncome: Math.round(body.netIncome),
      totalEarned: Math.round(body.totalEarned),
      buildings: Math.round(body.buildings),
      timestamp: Date.now(),
    };

    let entries = await loadEntries();

    const existing = entries.findIndex(e => e.name.toLowerCase() === entry.name.toLowerCase());
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

    return res.status(200).json({ ok: true, rank: entries.findIndex(e => e.name === entry.name) + 1 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
