import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { BeforePasswordChange } from '../../common/decorators/before-password-change.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { OrganizationMembersService } from '../organizations';
import { PermissionsRepository, PlatformRolesRepository } from '../rbac';
import { imageUploadOptions, StorageService, type UploadedFileInput } from '../storage';
import { type User, UsersRepository } from '../users';
import { AuthService } from './auth.service';
import { AuthThrottlerGuard } from './auth.throttler';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from './refresh-cookie';
import { requestMeta } from './request-meta';
import { SameOriginGuard } from './same-origin.guard';
import { type IssuedSession, SessionsService } from './sessions.service';

const INVALID_CREDENTIALS = { message: 'Unable to log in.', code: 'AUTH_INVALID_CREDENTIALS' };
const SESSION_EXPIRED = { message: 'Your session has ended. Log in again.', code: 'AUTH_SESSION_EXPIRED' };
const NO_PICTURE = { message: 'Choose a picture to upload.', code: 'AVATAR_MISSING' };

// A profile picture: one JPEG, PNG or WebP image (storage's rule) of at most 2 MB.
const avatarUploadOptions = { ...imageUploadOptions, limits: { ...imageUploadOptions.limits, fileSize: 2 * 1024 * 1024 } };

@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly users: UsersRepository,
    private readonly members: OrganizationMembersService,
    private readonly platformRoles: PlatformRolesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // Another site must not be able to log a visitor into a different account (login CSRF via an auto-submitted form).
  @UseGuards(SameOriginGuard)
  @SkipThrottle({ refresh: true, password: true })
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
  @SkipThrottle({ login: true, loginIp: true, password: true })
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
  @SkipThrottle({ login: true, loginIp: true, password: true })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const token: unknown = request.cookies?.[REFRESH_COOKIE];
    if (typeof token === 'string') await this.sessions.end(token, requestMeta(request));
    clearRefreshCookie(response);
  }

  @Authenticated()
  @BeforePasswordChange()
  @Get('me')
  @SkipThrottle({ login: true, loginIp: true, refresh: true, password: true })
  async me(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(SESSION_EXPIRED);
    const [workspaces, platformAccess] = await Promise.all([
      this.members.listActiveWorkspaces(userId),
      this.platformRoles.hasPlatformAccess(userId),
    ]);
    const granted = await this.permissions.grantedCodes([...new Set(workspaces.map(({ role }) => role.code))]);
    return {
      user: await this.publicUser(user),
      // Each company with the person's role there and what that role allows, so the interface shows only that.
      workspaces: workspaces.map((workspace) => ({ ...workspace, permissions: granted[workspace.role.code] ?? [] })),
      platformAccess,
      mustChangePassword: user.mustChangePassword === true,
    };
  }

  // Your own profile, no company needed. Not before you choose your own password: only /me and the change itself are.
  @Authenticated()
  @Patch('me')
  @SkipThrottle({ login: true, loginIp: true, refresh: true, password: true })
  async updateMe(@Body() body: UpdateProfileDto, @Req() request: AuthenticatedRequest) {
    const user = await this.auth.updateProfile(request.user!.id, body.displayName, requestMeta(request));
    return { user: await this.publicUser(user) };
  }

  // Your picture, the same in every company: multipart/form-data with the image in "file". Like PATCH /me, not before
  // you choose your own password.
  @Authenticated()
  @Put('me/avatar')
  @SkipThrottle({ login: true, loginIp: true, refresh: true, password: true })
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  async setAvatar(@UploadedFile() file: UploadedFileInput | undefined, @Req() request: AuthenticatedRequest) {
    if (!file) throw new BadRequestException(NO_PICTURE);
    const user = await this.auth.setAvatar(request.user!.id, file, requestMeta(request));
    return { user: await this.publicUser(user) };
  }

  @Authenticated()
  @Delete('me/avatar')
  @SkipThrottle({ login: true, loginIp: true, refresh: true, password: true })
  async removeAvatar(@Req() request: AuthenticatedRequest) {
    const user = await this.auth.removeAvatar(request.user!.id, requestMeta(request));
    return { user: await this.publicUser(user) };
  }

  @Authenticated()
  @BeforePasswordChange()
  @Post('password')
  @HttpCode(200)
  @SkipThrottle({ login: true, loginIp: true, refresh: true })
  async changePassword(@Body() body: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token: unknown = request.cookies?.[REFRESH_COOKIE];
    await this.auth.changePassword(userId, body, typeof token === 'string' ? token : undefined, requestMeta(request));
    return { accessToken: await this.sessions.issueAccessToken(userId) };
  }

  private async respondWithSession(response: Response, session: IssuedSession, user: User) {
    setRefreshCookie(response, session);
    return { accessToken: session.accessToken, user: await this.publicUser(user) };
  }

  // Who you are, as /me, login and refresh show it. displayName is null until you choose one; avatarUrl is a signed
  // link to your picture (valid 10 to 15 minutes, so /me hands out a fresh one), null for your initials.
  private async publicUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName ?? null,
      avatarUrl: await this.avatarUrl(user),
      createdAt: user.createdAt,
    };
  }

  // A picture that can't be found shows the initials: it must never stop you from logging in or loading /me.
  private async avatarUrl(user: User): Promise<string | null> {
    if (!user.avatarFileId) return null;
    return this.storage.accountFileUrl(user.avatarFileId).catch(() => null);
  }
}
