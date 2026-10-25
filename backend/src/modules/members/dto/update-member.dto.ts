import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// One change at a time: switch the membership off or on, or give it another role. The controller refuses both or
// neither.
export class UpdateMemberDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleCode?: string;
}
