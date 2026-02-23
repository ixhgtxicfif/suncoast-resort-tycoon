import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from './_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  const user = await verifyToken(auth.slice(7));
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  return res.status(200).json(user);
}
