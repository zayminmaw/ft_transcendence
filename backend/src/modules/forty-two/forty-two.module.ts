import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { UsersModule } from '../users';
import { FortyTwoApi } from './forty-two-api';
import { FortyTwoController } from './forty-two.controller';
import { FortyTwoService } from './forty-two.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [FortyTwoController],
  providers: [FortyTwoService, FortyTwoApi],
})
export class FortyTwoModule {}
