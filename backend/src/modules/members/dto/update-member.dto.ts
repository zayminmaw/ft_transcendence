import { IsBoolean, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

// One change at a time: switch the membership off or on, or give it another role. The controller refuses both or
// neither. A field left out is skipped; a field sent as null is checked (and refused), unlike with @IsOptional.
export class UpdateMemberDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleCode?: string;
}
