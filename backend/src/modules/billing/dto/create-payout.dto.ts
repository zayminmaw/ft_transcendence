import { IsString, Matches } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';
import { ID_PATTERN } from '../../../common/ids';

// What finance sends. The wire reference is the key that makes a repeated request safe; the amount is above zero with
// exactly two decimals, like the DECIMAL(12,2) columns.
export class CreatePayoutDto {
  @Matches(ID_PATTERN, { message: 'clientId must be an id' }) clientId!: string;

  @Trim() @IsString() @Matches(/^(?!0+\.00$)\d{1,10}\.\d{2}$/, { message: 'amount must be above zero with two decimals' })
  amount!: string;

  @Trim() @IsString() @Matches(/^[A-Za-z0-9._-]{4,40}$/, { message: 'wireReference must be 4-40 letters, numbers, dots, dashes or underscores' })
  wireReference!: string;
}
