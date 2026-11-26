import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Trim, TrimOrNull } from '../../../common/decorators/trim.decorator';

// An optional email locks the invite link to that address; leaving it out lets the invited user enter their own email.
export class CreateInviteDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleCode!: string;

  @TrimOrNull()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(191)
  email?: string | null;
}

