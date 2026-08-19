import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BackupController } from "./backup.controller";
import { BackupSchedulerService } from "./backup-scheduler.service";
import { BackupService } from "./backup.service";

/**
 * Database backup context — pg_dump jobs with status/progress persisted in
 * Prisma, signed download tokens, retention pruning, per-user rate limiting.
 *
 * All dependencies (PrismaService, TypedConfigService, LogService) come from
 * @Global() modules, so no imports are needed here. The single-job rule and
 * rate limiter are in-memory (KISS — no Redis/BullMQ for an ops feature that
 * runs at most a few times a day).
 */
@Module({
	imports: [AuthModule],
	controllers: [BackupController],
	providers: [BackupService, BackupSchedulerService],
	exports: [BackupService],
})
export class BackupModule {}
