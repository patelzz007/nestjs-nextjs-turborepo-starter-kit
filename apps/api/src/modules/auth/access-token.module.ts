import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { AccessTokenStateService } from "./services/access-token-state.service";

@Module({
	imports: [PrismaModule],
	providers: [AccessTokenStateService],
	exports: [AccessTokenStateService],
})
export class AccessTokenModule {}
