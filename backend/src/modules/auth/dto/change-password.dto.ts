import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  currentPassword!: string;

  // The password rule (8-128 characters, ...) is checked by the service, which answers with PASSWORD_RULE.
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  newPassword!: string;
}
