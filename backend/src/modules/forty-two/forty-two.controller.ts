import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { requestMeta, SessionsService, setRefreshCookie } from '../auth';
import { type FortyTwoFailure, FortyTwoService } from './forty-two.service';
import { clearStateCookie, newState, STATE_COOKIE, setStateCookie } from './state-cookie';

// Both answers are browser navigations, so every outcome is a redirect: /app with a session, or /login?oauth=<reason>.
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
