import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";

import { SessionStatusController } from "./session-status.controller";
import { SessionsController } from "./sessions.controller";
import { SessionsEventsService } from "./sessions-events.service";
import { SessionsService } from "./sessions.service";

@Module({
	imports: [PrismaModule, AuthModule, RbacModule],
	controllers: [SessionsController, SessionStatusController],
	providers: [SessionsService, SessionsEventsService],
	// SessionsEventsService is exported for Telescope's sessions-job adapter
	exports: [SessionsService, SessionsEventsService],
})
export class SessionsModule {}
