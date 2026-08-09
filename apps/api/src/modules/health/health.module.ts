import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";

import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

@Module({
	imports: [PrismaModule],
	controllers: [HealthController],
	providers: [HealthService],
	exports: [HealthService],
})
export class HealthModule {}
