import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";

import { ImpersonationController } from "./impersonation.controller";
import { ImpersonationEventsService } from "./impersonation-events.service";
import { ImpersonationService } from "./impersonation.service";

@Module({
	imports: [PrismaModule, AuthModule, RbacModule],
	controllers: [ImpersonationController],
	providers: [ImpersonationService, ImpersonationEventsService],
	// ImpersonationEventsService is exported for Telescope's impersonation-job adapter
	exports: [ImpersonationService, ImpersonationEventsService],
})
export class ImpersonationModule {}
