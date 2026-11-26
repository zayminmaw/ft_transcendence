import { IsString, MaxLength } from 'class-validator';

export class InvitePreviewDto {
  @IsString()
  @MaxLength(256)
  token!: string;
}
