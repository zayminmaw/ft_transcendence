import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Trim, TrimOrNull } from '../../../common/decorators/trim.decorator';

// Self-service registration from an admin-created invite link. Username, email and password rules are checked by
// createAccount so error codes stay consistent across every account creation path.
export class SignupDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @TrimOrNull()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(191)
  email?: string | null;

  @TrimOrNull()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^[^\p{Cc}\u2028\u2029]{0,64}$/u, { message: 'displayName must be one line of at most 64 characters' })
  displayName?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}

