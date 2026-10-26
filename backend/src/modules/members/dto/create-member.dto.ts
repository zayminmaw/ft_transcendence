import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Formats (username, email, the password rule) are checked by createAccount, which answers with a code.
export class CreateMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleCode!: string;
}
