import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { runWithSystemRlsContext } from "../../prisma/rls-context";
import { IdempotencyRetentionService, type IdempotencyRetentionSummary } from "./idempotency-retention.service";
import { IDEMPOTENCY_PURGE_INTERVAL_MS, IDEMPOTENCY_PURGE_SCHEDULER_ID, IDEMPOTENCY_RETENTION_OPERATION } from "./idempotency.constants";

/**
 * In-process retention schedule for deployments WITHOUT Redis (development,
 * single-instance setups — production requires Redis and uses the BullMQ
 * scheduler instead). Every interval it runs one purge under the
 * `idempotency.retention` system operation. Running on several instances at
 * once is safe: each batch is a conditional DELETE of rows that are already
 * semantically gone, so a concurrent run only finds less to delete.
 *
 * A failed run is logged at `error` and the next tick retries — the in-process
 * equivalent of BullMQ's retry; the timer itself never dies.
 */
@Injectable()
export class IdempotencyRetentionIntervalScheduler implements OnModuleInit, OnApplicationShutdown {
	private readonly logger: Logger = new Logger(IdempotencyRetentionIntervalScheduler.name);

	public constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly retention: IdempotencyRetentionService,
	) {}

	public onModuleInit(): void {
		const timer: NodeJS.Timeout = setInterval((): void => {
			void this.runOnce();
		}, IDEMPOTENCY_PURGE_INTERVAL_MS);
		timer.unref();
		this.schedulerRegistry.addInterval(IDEMPOTENCY_PURGE_SCHEDULER_ID, timer);
		this.logger.log(`Registered in-process idempotency retention every ${String(IDEMPOTENCY_PURGE_INTERVAL_MS)}ms (no Redis)`);
	}

	public onApplicationShutdown(): void {
		if (this.schedulerRegistry.doesExist("interval", IDEMPOTENCY_PURGE_SCHEDULER_ID)) {
			this.schedulerRegistry.deleteInterval(IDEMPOTENCY_PURGE_SCHEDULER_ID);
		}
	}

	/** One retention run. Never rejects: a failure is logged and retried on the next tick. */
	public async runOnce(): Promise<IdempotencyRetentionSummary | null> {
		try {
			return await runWithSystemRlsContext(IDEMPOTENCY_RETENTION_OPERATION, async (): Promise<IdempotencyRetentionSummary> => this.retention.purgeExpired());
		} catch (error) {
			this.logger.error({ event: "idempotency.retention_failed", error: error instanceof Error ? error.message : String(error) });
			return null;
		}
	}
}
