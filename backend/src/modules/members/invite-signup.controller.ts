import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthThrottlerGuard, requestMeta, SameOriginGuard, setRefreshCookie } from '../auth';
import { SignupDto } from './dto/signup.dto';
import { InvitePreviewDto } from './dto/invite-preview.dto';
import { InvitesService } from './invites.service';

// Public self-service registration endpoints backed by single-use admin invite links.
@Public()
@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class InviteSignupController {
  constructor(private readonly invites: InvitesService) {}

  // Bearer tokens belong in the body, never request URLs that proxies and browsers retain in logs.
  @Post('invites/preview')
  @HttpCode(200)
  @SkipThrottle({ login: true, refresh: true, password: true })
  inspect(@Body() body: InvitePreviewDto) {
    return this.invites.inspect(body.token);
  }

  @Post('signup')
  @UseGuards(SameOriginGuard)
  @SkipThrottle({ login: true, refresh: true, password: true })
  async signup(@Body() body: SignupDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { session, user, organizationSlug } = await this.invites.signup(body, requestMeta(request));
    setRefreshCookie(response, session);
    return { accessToken: session.accessToken, user, organizationSlug };
  }
}

