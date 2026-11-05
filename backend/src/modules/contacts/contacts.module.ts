import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { NotificationsModule } from "../notifications";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { ContactsStoreModule } from "./contacts-store.module";

@Module({
	imports: [ContactsStoreModule, AuditModule, NotificationsModule],
	controllers: [ContactsController],
	providers: [ContactsService],
	exports: [ContactsService],
})
export class ContactsModule {}
