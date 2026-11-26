import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthThrottlerGuard, requestMeta, SameOriginGuard, setRefreshCookie } from '../auth';
import { SignupDto } from './dto/signup.dto';
import { InvitesService } from './invites.service';

// Public self-service registration endpoints backed by single-use admin invite links.
@Public()
@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class InviteSignupController {
  constructor(private readonly invites: InvitesService) {}

  @Get('invites/:token')
  @SkipThrottle({ login: true, refresh: true, password: true })
  inspect(@Param('token') token: string) {
    return this.invites.inspect(token);
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

