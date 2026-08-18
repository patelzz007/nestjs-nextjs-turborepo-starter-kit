import { Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { epochMs, type BackupSchedule, type BackupScheduleToggleResponse } from "@workspace/shared";
import { z } from "zod";

import { LogService } from "../logs/logs.service";
import { nextCronRunMs } from "./backup-utils";

const ThrownSchema = z.object({ message: z.string() });

type ScheduledJob = {
	readonly cron: string;
	readonly name: string;
	readonly enabled: boolean;
	readonly nextRun: number;
};

/**
 * In-memory backup cron (single API replica). Owns the minute ticker and
 * clears it on shutdown.
 */
@Injectable()
export class BackupSchedulerService implements OnModuleDestroy {
	private readonly scheduledJobs = new Map<string, ScheduledJob>();
	private tick: ReturnType<typeof setInterval> | undefined;
	private onFire: ((name: string) => Promise<void>) | undefined;

	public constructor(private readonly logs: LogService) {}

	public start(onFire: (name: string) => Promise<void>): void {
		this.onFire = onFire;
		this.scheduledJobs.set("daily", {
			cron: "0 2 * * *",
			name: "daily_full_backup",
			enabled: true,
			nextRun: nextCronRunMs("0 2 * * *", Date.now()),
		});
		this.scheduledJobs.set("weekly", {
			cron: "0 3 * * 0",
			name: "weekly_full_backup",
			enabled: true,
			nextRun: nextCronRunMs("0 3 * * 0", Date.now()),
		});
		if (this.tick !== undefined) {
			clearInterval(this.tick);
		}
		this.tick = setInterval((): void => {
			this.checkSchedules();
		}, 60_000);
	}

	public onModuleDestroy(): void {
		this.stop();
	}

	public stop(): void {
		if (this.tick !== undefined) {
			clearInterval(this.tick);
			this.tick = undefined;
		}
	}

	public getSchedules(): BackupSchedule[] {
		return Array.from(this.scheduledJobs.entries()).map(([id, schedule]): BackupSchedule => ({
			id,
			cron: schedule.cron,
			name: schedule.name,
			enabled: schedule.enabled,
			nextRun: epochMs(schedule.nextRun),
		}));
	}

	public toggleSchedule(id: string, enabled: boolean): BackupScheduleToggleResponse {
		const schedule = this.scheduledJobs.get(id);
		if (schedule === undefined) throw new NotFoundException(`Schedule ${id} not found.`);
		this.scheduledJobs.set(id, { ...schedule, enabled });
		return { toggled: true, id, enabled };
	}

	private checkSchedules(): void {
		const now = Date.now();
		const fire = this.onFire;
		if (fire === undefined) {
			return;
		}
		for (const [id, schedule] of this.scheduledJobs) {
			if (!schedule.enabled) continue;
			if (now >= schedule.nextRun) {
				void fire(schedule.name).then(
					(): void => undefined,
					(error: object): void => {
						const parsed = ThrownSchema.safeParse(error);
						this.logs.error(`Scheduled backup failed: ${parsed.success ? parsed.data.message : "unknown error"}`, {
							context: "BackupScheduler",
						});
					},
				);
				this.scheduledJobs.set(id, { ...schedule, nextRun: nextCronRunMs(schedule.cron, now) });
			}
		}
	}
}
