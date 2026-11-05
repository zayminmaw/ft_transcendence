import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContactsRepository } from "./contacts.repository";
import { Contact } from "./entities/contact.entity";

// The contacts queries on their own, so the modules that only need to know who saved whom (presence) can import them
// without the controller and its dependencies.
@Module({
	imports: [TypeOrmModule.forFeature([Contact])],
	providers: [ContactsRepository],
	exports: [ContactsRepository],
})
export class ContactsStoreModule {}
