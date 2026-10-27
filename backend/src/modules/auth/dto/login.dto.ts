import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

export class LoginDto {
  // Plain printable ASCII only. The users columns compare with utf8mb4_unicode_ci, which treats "dána.salèh" as
  // "dana.saleh"; accented look-alikes would otherwise each get their own login throttle count.
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Matches(/^[\x21-\x7E]+$/, { message: 'login must be an email or username without spaces or accented letters' })
  login!: string;

  // The password rule applies when a password is set, not when logging in.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
