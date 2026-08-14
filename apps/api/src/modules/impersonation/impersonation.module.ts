import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { RbacModule } from "../rbac/rbac.module.js";

import { ImpersonationController } from "./impersonation.controller.js";
import { ImpersonationEventsService } from "./impersonation-events.service.js";
import { ImpersonationService } from "./impersonation.service.js";

@Module({
	imports: [PrismaModule, AuthModule, RbacModule],
	controllers: [ImpersonationController],
	providers: [ImpersonationService, ImpersonationEventsService],
	// ImpersonationEventsService is exported for Telescope's impersonation-job adapter
	exports: [ImpersonationService, ImpersonationEventsService],
})
export class ImpersonationModule {}
