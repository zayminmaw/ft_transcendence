import { IsString, Matches } from "class-validator";

// The person to add, by user id. Whether they may be added is the server's call (role rules, same company, active).
export class AddContactDto {
	@IsString()
	@Matches(/^[1-9]\d{0,19}$/, {
		message: "userId must be a positive integer",
	})
	userId!: string;
}
