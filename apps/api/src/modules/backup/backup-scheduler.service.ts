import { Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { epochMs, type BackupSchedule, type BackupScheduleToggleResponse } from "@workspace/shared";
import { z } from "zod";

import { PrismaService } from "../../prisma/prisma.service";
import { LogService } from "../logs/logs.service";
import { nextCronRunMs } from "./backup-utils";

const ThrownSchema = z.object({ message: z.string() });

/** Default schedules seeded on first start if the DB table is empty. */
const DEFAULT_SCHEDULES: readonly { readonly id: string; readonly cron: string; readonly name: string }[] = [
	{ id: "daily", cron: "0 2 * * *", name: "daily_full_backup" },
	{ id: "weekly", cron: "0 3 * * 0", name: "weekly_full_backup" },
];

/**
 * DB-backed backup cron scheduler. Schedule definitions live in the
 * `telescope_backup_schedules` table so they survive restarts and work
 * across multiple API replicas. The minute ticker still runs per-process
 * (only one replica fires the backup via the `onFire` callback).
 */
@Injectable()
export class BackupSchedulerService implements OnModuleDestroy {
	private tick: ReturnType<typeof setInterval> | undefined;
	private onFire: ((name: string) => Promise<void>) | undefined;

	public constructor(
		private readonly prisma: PrismaService,
		private readonly logs: LogService,
	) {}

	/** Seeds default schedules if the table is empty, then starts the ticker. */
	public async start(onFire: (name: string) => Promise<void>): Promise<void> {
		this.onFire = onFire;
		await this.ensureDefaults();
		if (this.tick !== undefined) {
			clearInterval(this.tick);
		}
		this.tick = setInterval((): void => {
			void this.checkSchedules();
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

	/** Returns all schedules from the DB. */
	public async getSchedules(): Promise<BackupSchedule[]> {
		const rows = await this.prisma.telescopeBackupSchedule.findMany({ orderBy: { name: "asc" } });
		return rows.map((row): BackupSchedule => ({
			id: row.id,
			cron: row.cron,
			name: row.name,
			enabled: row.enabled,
			nextRun: epochMs(Number(row.nextRun)),
		}));
	}

	/** Toggles a schedule on/off in the DB. */
	public async toggleSchedule(id: string, enabled: boolean): Promise<BackupScheduleToggleResponse> {
		const row = await this.prisma.telescopeBackupSchedule.findUnique({ where: { id } });
		if (row === null) throw new NotFoundException(`Schedule ${id} not found.`);
		await this.prisma.telescopeBackupSchedule.update({ where: { id }, data: { enabled } });
		return { toggled: true, id, enabled };
	}

	/** Checks if any schedule is due and fires it, then updates nextRun in DB. */
	private async checkSchedules(): Promise<void> {
		const now = Date.now();
		const fire = this.onFire;
		if (fire === undefined) return;

		const rows = await this.prisma.telescopeBackupSchedule.findMany({ where: { enabled: true } });
		for (const row of rows) {
			const nextRunMs = Number(row.nextRun);
			if (now >= nextRunMs) {
				void fire(row.name).then(
					(): void => undefined,
					(error: unknown): void => {
						const parsed = ThrownSchema.safeParse(error);
						this.logs.error(`Scheduled backup failed: ${parsed.success ? parsed.data.message : "unknown error"}`, {
							context: "BackupScheduler",
						});
					},
				);
				// Update nextRun in DB so other replicas don't double-fire.
				await this.prisma.telescopeBackupSchedule.update({
					where: { id: row.id },
					data: { nextRun: BigInt(nextCronRunMs(row.cron, now)) },
				});
			}
		}
	}

	/** Seeds default schedules into the DB if the table is empty. */
	private async ensureDefaults(): Promise<void> {
		const count = await this.prisma.telescopeBackupSchedule.count();
		if (count > 0) return;
		const now = Date.now();
		for (const def of DEFAULT_SCHEDULES) {
			await this.prisma.telescopeBackupSchedule.create({
				data: {
					id: def.id,
					cron: def.cron,
					name: def.name,
					enabled: true,
					nextRun: BigInt(nextCronRunMs(def.cron, now)),
				},
			});
			this.logs.info(`Seeded backup schedule: ${def.name}`, { context: "BackupScheduler" });
		}
	}
}
