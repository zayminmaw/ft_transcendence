import { IsString, Matches, ValidateIf } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

// Your own profile. Only the display name: username and login email are an admin's (42 login matches on email).
export class UpdateProfileDto {
  // One line, at most 64 characters after trimming. null or "" clears it, and your username shows instead.
  // The regex counts characters as the database column does; @MaxLength would let an emoji's hidden variation
  // selector go uncounted, and a name too long for the column would fail as a 500.
  @Trim()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^\P{Cc}{0,64}$/u, { message: 'displayName must be one line of at most 64 characters' })
  displayName!: string | null;
}
