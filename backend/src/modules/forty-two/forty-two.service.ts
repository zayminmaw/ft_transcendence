import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../common/config/environment';
import { AuthAuditRepository, type RequestMeta } from '../auth';
import { type User, UsersRepository } from '../users';
import { FORTYTWO_AUTHORIZE_URL, type FortyTwoCredentials, FortyTwoApi } from './forty-two-api';
import { stateMatches } from './state-cookie';

export type FortyTwoFailure = 'denied' | 'failed' | 'no_account' | 'unavailable';
export type FortyTwoOutcome = { user: User } | { failure: FortyTwoFailure };

export interface FortyTwoCallback {
  code: unknown;
  state: unknown;
  error: unknown;
  expectedState: unknown;
}

// 42 login never creates an account: it signs in the active user whose email is the 42 account's email.
@Injectable()
export class FortyTwoService {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly api: FortyTwoApi,
    private readonly users: UsersRepository,
    private readonly audit: AuthAuditRepository,
  ) {}

  // Undefined when the 42 client id or secret isn't set.
  authorizeUrl(state: string): string | undefined {
    const credentials = this.credentials();
    if (!credentials) return undefined;
    const query = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      response_type: 'code',
      scope: 'public',
      state,
    });
    return `${FORTYTWO_AUTHORIZE_URL}?${query}`;
  }

  async login(callback: FortyTwoCallback, meta: RequestMeta): Promise<FortyTwoOutcome> {
    const credentials = this.credentials();
    if (!credentials) return { failure: 'unavailable' };
    if (callback.error !== undefined) return { failure: 'denied' };
    if (!stateMatches(callback.expectedState, callback.state) || typeof callback.code !== 'string' || !callback.code) {
      return { failure: 'failed' };
    }
    let email: string;
    try {
      email = await this.api.fetchEmail(await this.api.exchangeCode(callback.code, credentials));
    } catch {
      return { failure: 'failed' };
    }
    const user = await this.users.findByLogin(email.trim());
    if (!user || !user.isActive) {
      await this.audit.record('login_failed', user?.id ?? null, meta);
      return { failure: 'no_account' };
    }
    await this.users.touchLastLogin(user.id);
    await this.audit.record('login', user.id, meta);
    return { user };
  }

  private credentials(): FortyTwoCredentials | undefined {
    const clientId = this.config.get('FORTYTWO_APP_ID', { infer: true });
    const clientSecret = this.config.get('FORTYTWO_APP_SECRET', { infer: true });
    if (!clientId || !clientSecret) return undefined;
    const redirectUri =
      this.config.get('FORTYTWO_REDIRECT_URI', { infer: true }) || `${this.config.get('CORS_ORIGIN', { infer: true })}/api/auth/42/callback`;
    return { clientId, clientSecret, redirectUri };
  }
}
