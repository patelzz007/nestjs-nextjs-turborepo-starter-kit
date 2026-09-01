import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";

import { SessionStatusController } from "./session-status.controller";
import { SessionsController } from "./sessions.controller";
import { SessionsEventsService } from "./sessions-events.service";
import { SessionsService } from "./sessions.service";

@Module({
	imports: [PrismaModule, AuthModule, AuthorizationModule],
	controllers: [SessionsController, SessionStatusController],
	providers: [SessionsService, SessionsEventsService],
	exports: [SessionsService, SessionsEventsService],
})
export class SessionsModule {}
