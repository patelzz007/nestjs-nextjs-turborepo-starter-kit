import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { RbacModule } from "../rbac/rbac.module.js";

import { ImpersonationController } from "./impersonation.controller.js";
import { ImpersonationService } from "./impersonation.service.js";

@Module({
	imports: [PrismaModule, AuthModule, RbacModule],
	controllers: [ImpersonationController],
	providers: [ImpersonationService],
	exports: [ImpersonationService],
})
export class ImpersonationModule {}
