import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { VersionController } from "./version.controller";

@Module({
	imports: [PrismaModule],
	controllers: [HealthController, VersionController],
	providers: [HealthService],
	exports: [HealthService],
})
export class HealthModule {}
