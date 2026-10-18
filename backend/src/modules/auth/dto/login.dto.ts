import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  login!: string;

  // The password rule applies when a password is set, not when logging in.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
