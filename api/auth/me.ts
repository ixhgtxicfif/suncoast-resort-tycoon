import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

interface UserPayload { sub: string; email: string; name: string; picture: string; }

function verifyJwt(token: string): UserPayload | null {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  const user = verifyJwt(auth.slice(7));
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  return res.status(200).json(user);
}
