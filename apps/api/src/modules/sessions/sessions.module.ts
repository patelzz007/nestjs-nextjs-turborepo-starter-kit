import { Module } from "@nestjs/common";

import { OutboxModule } from "../../infrastructure/outbox/outbox.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";

import { SessionStatusController } from "./session-status.controller";
import { SessionsController } from "./sessions.controller";
import { SessionsPersistenceModule } from "./sessions-persistence.module";
import { SessionsService } from "./sessions.service";

@Module({
	imports: [PrismaModule, OutboxModule, SessionsPersistenceModule, AuthModule, AuthorizationModule],
	controllers: [SessionsController, SessionStatusController],
	providers: [SessionsService],
	exports: [SessionsService, SessionsPersistenceModule],
})
export class SessionsModule {}
