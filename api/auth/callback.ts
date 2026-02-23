import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';
import { createToken, type UserPayload } from './_jwt';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/callback`;

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      return res.status(400).json({ error: 'Token exchange failed', details: err });
    }

    const tokens: GoogleTokenResponse = await tokenResp.json();

    const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResp.ok) {
      return res.status(400).json({ error: 'Failed to fetch user info' });
    }

    const gUser: GoogleUserInfo = await userResp.json();

    const userPayload: UserPayload = {
      sub: gUser.sub,
      email: gUser.email,
      name: gUser.name,
      picture: gUser.picture,
    };

    await saveUserProfile(userPayload);

    const jwt = await createToken(userPayload);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    res.redirect(302, `${appUrl}/?token=${jwt}`);
  } catch (err: any) {
    res.status(500).json({ error: 'Auth callback failed', message: err.message });
  }
}

async function saveUserProfile(user: UserPayload): Promise<void> {
  const blobName = `users/${user.sub}.json`;

  const { blobs } = await list({ prefix: blobName });
  let profile: any = {
    ...user,
    createdAt: Date.now(),
    sessions: 0,
  };

  if (blobs.length > 0) {
    try {
      const existing = await fetch(blobs[0].url).then(r => r.json());
      profile = {
        ...existing,
        name: user.name,
        picture: user.picture,
        email: user.email,
        sessions: (existing.sessions || 0) + 1,
        lastLogin: Date.now(),
      };
    } catch { /* use fresh profile */ }
  }

  await put(blobName, JSON.stringify(profile), {
    access: 'public',
    contentType: 'application/json',
  });
}
