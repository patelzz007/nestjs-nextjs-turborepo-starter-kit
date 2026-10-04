import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { ImpersonationSessionRepository } from "./repositories/impersonation-session.repository";
import { AccessTokenStateService } from "./services/access-token-state.service";
import { ImpersonationSessionStateService } from "./services/impersonation-session-state.service";

@Module({
	imports: [PrismaModule],
	providers: [AccessTokenStateService, ImpersonationSessionRepository, ImpersonationSessionStateService],
	exports: [AccessTokenStateService, ImpersonationSessionRepository, ImpersonationSessionStateService],
})
export class AccessTokenModule {}
