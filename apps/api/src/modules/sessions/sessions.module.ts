import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { RbacModule } from "../rbac/rbac.module.js";

import { SessionStatusController } from "./session-status.controller.js";
import { SessionsController } from "./sessions.controller.js";
import { SessionsService } from "./sessions.service.js";

@Module({
	imports: [PrismaModule, AuthModule, RbacModule],
	controllers: [SessionsController, SessionStatusController],
	providers: [SessionsService],
	exports: [SessionsService],
})
export class SessionsModule {}
