import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthThrottlerGuard, requestMeta, SessionsService, setRefreshCookie } from '../auth';
import { type FortyTwoFailure, FortyTwoService } from './forty-two.service';
import { clearStateCookie, newState, STATE_COOKIE, setStateCookie } from './state-cookie';

// Both answers are browser navigations, so every outcome the handlers reach is a redirect: /app with a session, or
// /login?oauth=<reason>. Only the callback's rate limit answers otherwise, before its handler runs.
const loginPage = (failure: FortyTwoFailure) => `/login?oauth=${failure}`;

@Public()
@Controller('auth/42')
export class FortyTwoController {
  constructor(
    private readonly fortyTwo: FortyTwoService,
    private readonly sessions: SessionsService,
  ) {}

  @Get()
  start(@Res() response: Response): void {
    const state = newState();
    const url = this.fortyTwo.authorizeUrl(state);
    if (!url) return response.redirect(loginPage('unavailable'));
    setStateCookie(response, state);
    response.redirect(url);
  }

  @Get('callback')
  // Anyone can invent a matching cookie and state, and each try can call 42 with a 10-second timeout.
  // shortcut: over the limit shows the guard's JSON 429, not /login; add a redirect if real users hit it.
  @UseGuards(AuthThrottlerGuard)
  @SkipThrottle({ login: true, refresh: true, password: true })
  async callback(@Query() query: Record<string, unknown>, @Req() request: Request, @Res() response: Response): Promise<void> {
    const expectedState: unknown = request.cookies?.[STATE_COOKIE];
    // A state is good for one attempt, whatever the outcome.
    clearStateCookie(response);
    const meta = requestMeta(request);
    const outcome = await this.fortyTwo.login({ code: query.code, state: query.state, error: query.error, expectedState }, meta);
    if ('failure' in outcome) return response.redirect(loginPage(outcome.failure));
    // Ends exactly like password login; the app picks the session up from the refresh cookie on load.
    setRefreshCookie(response, await this.sessions.start(outcome.user.id, meta));
    response.redirect('/app');
  }
}
