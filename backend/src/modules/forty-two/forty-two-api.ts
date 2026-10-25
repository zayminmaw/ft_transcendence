import { Injectable } from '@nestjs/common';

export const FORTYTWO_AUTHORIZE_URL = 'https://api.intra.42.fr/oauth/authorize';
const TOKEN_URL = 'https://api.intra.42.fr/oauth/token';
const ME_URL = 'https://api.intra.42.fr/v2/me';
const TIMEOUT_MS = 10_000;

export interface FortyTwoCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// The two calls to the 42 API. Any refusal, timeout or unexpected answer throws; the caller treats them all alike.
// Tokens never leave this class and are never logged.
@Injectable()
export class FortyTwoApi {
  async exchangeCode(code: string, credentials: FortyTwoCredentials): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: credentials.redirectUri,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`42 token exchange answered ${response.status}`);
    const body = (await response.json()) as { access_token?: unknown };
    if (typeof body.access_token !== 'string' || !body.access_token) throw new Error('42 token exchange gave no token');
    return body.access_token;
  }

  async fetchEmail(accessToken: string): Promise<string> {
    const response = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`42 profile answered ${response.status}`);
    const body = (await response.json()) as { email?: unknown };
    if (typeof body.email !== 'string' || !body.email.includes('@')) throw new Error('42 profile gave no email');
    return body.email;
  }
}
