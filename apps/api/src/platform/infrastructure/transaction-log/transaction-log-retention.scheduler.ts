import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { nowEpochMs, CaughtValueSchema } from "@workspace/shared";

import { TransactionLogFileWriter, type TransactionLogPurgeResult } from "./transaction-log-file-writer";
import { TRANSACTION_LOG_RETENTION_INTERVAL_ID, TRANSACTION_LOG_RETENTION_INTERVAL_MS } from "./transaction-log.constants";
import { caughtErrorLogFields } from "../../application/errors/caught-error-log";

/**
 * Deletes day files past TRANSACTION_LOG_RETENTION_DAYS: at boot, then hourly.
 *
 * In-process on EVERY instance, with or without Redis, on purpose: the files
 * live on each instance's own disk (or a folder they share), so a cluster-wide
 * BullMQ job would clean only the disk of whichever instance picked it up. On
 * a shared folder concurrent runs are harmless — a file another instance
 * already deleted is skipped.
 *
 * A failed run is logged at `error` and the next tick retries; the timer never dies.
 */
@Injectable()
export class TransactionLogRetentionScheduler implements OnModuleInit, OnApplicationShutdown {
	private readonly logger: Logger = new Logger(TransactionLogRetentionScheduler.name);

	public constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly writer: TransactionLogFileWriter,
	) {}

	public onModuleInit(): void {
		const timer: NodeJS.Timeout = setInterval((): void => {
			void this.runOnce();
		}, TRANSACTION_LOG_RETENTION_INTERVAL_MS);
		timer.unref();
		this.schedulerRegistry.addInterval(TRANSACTION_LOG_RETENTION_INTERVAL_ID, timer);
		void this.runOnce();
	}

	public onApplicationShutdown(): void {
		if (this.schedulerRegistry.doesExist("interval", TRANSACTION_LOG_RETENTION_INTERVAL_ID)) {
			this.schedulerRegistry.deleteInterval(TRANSACTION_LOG_RETENTION_INTERVAL_ID);
		}
	}

	/** One retention run. Never rejects: a failure is logged and retried on the next tick. */
	public async runOnce(): Promise<TransactionLogPurgeResult | null> {
		try {
			const result: TransactionLogPurgeResult = await this.writer.purgeExpired(nowEpochMs());
			if (result.deletedFiles.length > 0) {
				this.logger.log({ event: "transaction_log.retention_summary", ...result });
			}
			return result;
		} catch (error) {
			this.logger.error({ event: "transaction_log.retention_failed", ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			return null;
		}
	}
}
