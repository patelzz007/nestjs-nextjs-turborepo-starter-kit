import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";

import { SessionStatusController } from "./session-status.controller";
import { SessionsController } from "./sessions.controller";
import { SessionsEventsService } from "./sessions-events.service";
import { SessionsPersistenceModule } from "./sessions-persistence.module";
import { SessionsService } from "./sessions.service";

@Module({
	imports: [PrismaModule, SessionsPersistenceModule, AuthModule, AuthorizationModule],
	controllers: [SessionsController, SessionStatusController],
	providers: [SessionsService, SessionsEventsService],
	exports: [SessionsService, SessionsEventsService, SessionsPersistenceModule],
})
export class SessionsModule {}
