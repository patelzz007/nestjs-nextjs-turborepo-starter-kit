// ============================================
// infrastructure/operations.scheduler.ts — the console's timers, on every instance
// ============================================
// Every 10 s: this instance's heartbeat. Every minute: the collection (dependencies, alert rules)
// on whichever instance wins the minute's lock. Every hour: the history rollup and retention, and
// the backup schedule. Each tick never rejects: a failure is logged and the next tick retries.

import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { OPS_HOUR_MS, OPS_MINUTE_MS, OPS_SAMPLE_INTERVAL_MS } from "@workspace/shared";

import type { BackupRunner } from "../application/services/backup-runner";
import type { HistoryMaintainer } from "../application/services/history-maintainer";
import type { InstanceReporter } from "../application/services/instance-reporter";
import type { OperationsMonitor } from "../application/services/operations-monitor";
import { BACKUP_RUNNER, HISTORY_MAINTAINER, INSTANCE_REPORTER, OPERATIONS_MONITOR } from "../application/ports/operations.tokens";

const HEARTBEAT_INTERVAL_ID = "operations.heartbeat";
const MINUTE_INTERVAL_ID = "operations.minute";
const HOUR_INTERVAL_ID = "operations.hour";
/** The hourly work also runs this long after boot, so a fresh deployment does not wait an hour. */
const FIRST_HOURLY_RUN_DELAY_MS = OPS_MINUTE_MS;

@Injectable()
export class OperationsScheduler implements OnModuleInit, OnApplicationShutdown {
	private readonly logger: Logger = new Logger(OperationsScheduler.name);
	private firstHourly: NodeJS.Timeout | undefined;

	public constructor(
		private readonly registry: SchedulerRegistry,
		@Inject(INSTANCE_REPORTER) private readonly reporter: InstanceReporter,
		@Inject(OPERATIONS_MONITOR) private readonly monitor: OperationsMonitor,
		@Inject(HISTORY_MAINTAINER) private readonly maintainer: HistoryMaintainer,
		@Inject(BACKUP_RUNNER) private readonly backups: BackupRunner,
	) {}

	public onModuleInit(): void {
		this.every(HEARTBEAT_INTERVAL_ID, OPS_SAMPLE_INTERVAL_MS, () => this.reporter.tick());
		this.every(MINUTE_INTERVAL_ID, OPS_MINUTE_MS, async () => {
			await this.monitor.collectMinute();
		});
		this.every(HOUR_INTERVAL_ID, OPS_HOUR_MS, () => this.hourly());
		this.firstHourly = setTimeout((): void => {
			void this.safely("operations.hourly", () => this.hourly());
		}, FIRST_HOURLY_RUN_DELAY_MS);
		this.firstHourly.unref();
	}

	/** A clean shutdown: the timers stop and this instance leaves the list (so it is not reported Down). */
	public async onApplicationShutdown(): Promise<void> {
		clearTimeout(this.firstHourly);
		for (const id of [HEARTBEAT_INTERVAL_ID, MINUTE_INTERVAL_ID, HOUR_INTERVAL_ID]) {
			if (this.registry.doesExist("interval", id)) {
				this.registry.deleteInterval(id);
			}
		}
		await this.safely("operations.leave", () => this.reporter.leave());
	}

	private async hourly(): Promise<void> {
		await this.maintainer.maintain();
		await this.backups.scheduledCheck();
	}

	private every(id: string, intervalMs: number, work: () => Promise<void>): void {
		const timer: NodeJS.Timeout = setInterval((): void => {
			void this.safely(id, work);
		}, intervalMs);
		timer.unref();
		this.registry.addInterval(id, timer);
	}

	private async safely(id: string, work: () => Promise<void>): Promise<void> {
		try {
			await work();
		} catch (error) {
			this.logger.error({ event: `${id}.failed`, error: error instanceof Error ? error.message : String(error) });
		}
	}
}
