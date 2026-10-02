import { Module } from "@nestjs/common";

import { OutboxModule } from "../../infrastructure/outbox/outbox.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";

import { ImpersonationController } from "./impersonation.controller";
import { ImpersonationService } from "./impersonation.service";

@Module({
	imports: [PrismaModule, AuthModule, AuthorizationModule, OutboxModule],
	controllers: [ImpersonationController],
	providers: [ImpersonationService],
	exports: [ImpersonationService],
})
export class ImpersonationModule {}
