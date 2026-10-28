import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

// Your own profile. Only the display name: username and login email are an admin's (42 login matches on email).
export class UpdateProfileDto {
  // One line, at most 64 characters after trimming. null or "" clears it, and your username shows instead.
  @Trim()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  @Matches(/^\P{Cc}*$/u, { message: 'displayName must be one line without control characters' })
  displayName!: string | null;
}
