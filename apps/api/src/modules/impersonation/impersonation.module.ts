import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";

import { ImpersonationController } from "./impersonation.controller";
import { ImpersonationEventsService } from "./impersonation-events.service";
import { ImpersonationService } from "./impersonation.service";

@Module({
	imports: [PrismaModule, AuthModule, AuthorizationModule],
	controllers: [ImpersonationController],
	providers: [ImpersonationService, ImpersonationEventsService],
	exports: [ImpersonationService, ImpersonationEventsService],
})
export class ImpersonationModule {}
