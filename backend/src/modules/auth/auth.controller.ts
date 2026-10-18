import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { OrganizationMembersService } from '../organizations';
import { PlatformRolesRepository } from '../rbac';
import { type User, UsersRepository } from '../users';
import { AuthService } from './auth.service';
import { AuthThrottlerGuard } from './auth.throttler';
import { LoginDto } from './dto/login.dto';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from './refresh-cookie';
import { requestMeta } from './request-meta';
import { SameOriginGuard } from './same-origin.guard';
import { type IssuedSession, SessionsService } from './sessions.service';

const INVALID_CREDENTIALS = { message: 'Unable to log in.', code: 'AUTH_INVALID_CREDENTIALS' };
const SESSION_EXPIRED = { message: 'Your session has ended. Log in again.', code: 'AUTH_SESSION_EXPIRED' };

function publicUser(user: User) {
  return { id: user.id, username: user.username, email: user.email };
}

@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly users: UsersRepository,
    private readonly members: OrganizationMembersService,
    private readonly platformRoles: PlatformRolesRepository,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // Another site must not be able to log a visitor into a different account (login CSRF via an auto-submitted form).
  @UseGuards(SameOriginGuard)
  @SkipThrottle({ refresh: true })
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const meta = requestMeta(request);
    const user = await this.auth.verifyLogin(body.login, body.password, meta);
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return this.respondWithSession(response, await this.sessions.start(user.id, meta), user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(SameOriginGuard)
  @SkipThrottle({ login: true, loginIp: true })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token: unknown = request.cookies?.[REFRESH_COOKIE];
    const session = typeof token === 'string' ? await this.sessions.refresh(token, requestMeta(request)) : undefined;
    const user = session ? await this.users.findById(session.userId) : undefined;
    if (!session || !user) {
      clearRefreshCookie(response);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    return this.respondWithSession(response, session, user);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SameOriginGuard)
  @SkipThrottle({ login: true, loginIp: true })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const token: unknown = request.cookies?.[REFRESH_COOKIE];
    if (typeof token === 'string') await this.sessions.end(token, requestMeta(request));
    clearRefreshCookie(response);
  }

  @Authenticated()
  @Get('me')
  @SkipThrottle({ login: true, loginIp: true, refresh: true })
  async me(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(SESSION_EXPIRED);
    const [workspaces, platformAccess] = await Promise.all([
      this.members.listActiveWorkspaces(userId),
      this.platformRoles.hasPlatformAccess(userId),
    ]);
    return { user: publicUser(user), workspaces, platformAccess };
  }

  private respondWithSession(response: Response, session: IssuedSession, user: User) {
    setRefreshCookie(response, session);
    return { accessToken: session.accessToken, user: publicUser(user) };
  }
}
