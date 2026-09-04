import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { moduleHealthIndicatorsProvider } from "./module-health-indicators.provider";
import { VersionController } from "./version.controller";

/**
 * Health module that provides application health checks.
 *
 * Module health indicators are registered individually by each module
 * and aggregated in the HealthService via optional injection.
 */
@Module({
	imports: [PrismaModule],
	controllers: [HealthController, VersionController],
	providers: [HealthService, moduleHealthIndicatorsProvider],
	exports: [HealthService],
})
export class HealthModule {}
