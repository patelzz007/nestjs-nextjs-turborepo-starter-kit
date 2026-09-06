import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { SessionUserRepository } from "./repositories/session-user.repository";

@Module({
	imports: [PrismaModule],
	providers: [RefreshTokenRepository, SessionUserRepository],
	exports: [RefreshTokenRepository, SessionUserRepository],
})
export class SessionsPersistenceModule {}
