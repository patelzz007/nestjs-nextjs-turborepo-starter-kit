import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS, QUEUE_NAMES, TransactionLogWriteJobSchema, type TransactionLogWriteJob } from "@workspace/shared";
import type { Queue } from "bullmq";

import type { HttpAuditEntry } from "../audit/http-audit-entry";
import { TransactionLogFileWriter } from "./transaction-log-file-writer";
import { TRANSACTION_LOG_APPEND_JOB_NAME, TRANSACTION_LOG_GLOBAL_CONCURRENCY } from "./transaction-log.constants";
import { TransactionLog } from "./transaction-log.port";

/** The queue calls this log makes (a BullMQ `Queue` satisfies it; tests pass a fake). */
export type TransactionLogQueue = Pick<Queue<TransactionLogWriteJob>, "add" | "setGlobalConcurrency">;

/**
 * With Redis: each entry becomes one `transaction-log.write` job, and the
 * `TransactionLogWriteProcessor` worker appends it to the file, retrying a
 * failed write with backoff. The request only formats the entry; it never waits
 * for Redis or the disk.
 *
 * Redis unreachable is not a reason to lose the entry (no single point of
 * failure): when the job cannot be queued, the entry is appended directly by
 * this instance instead, and a warning says so.
 */
@Injectable()
export class QueuedTransactionLog extends TransactionLog implements OnModuleInit {
	private readonly logger: Logger = new Logger(QueuedTransactionLog.name);

	public constructor(
		@InjectQueue(QUEUE_NAMES.transactionLogWrite) private readonly queue: TransactionLogQueue,
		private readonly writer: TransactionLogFileWriter,
	) {
		super();
	}

	/** One worker at a time, cluster-wide (idempotent: every instance sets the same limit at boot). */
	public onModuleInit(): void {
		void this.queue.setGlobalConcurrency(TRANSACTION_LOG_GLOBAL_CONCURRENCY).catch((error: unknown): void => {
			this.logger.warn({ event: "transaction_log.concurrency_not_set", error: error instanceof Error ? error.message : String(error) });
		});
	}

	public record(entry: HttpAuditEntry): void {
		const job: TransactionLogWriteJob = TransactionLogWriteJobSchema.parse({ occurredAt: entry.occurredAt, text: this.writer.format(entry) });
		void this.queue.add(TRANSACTION_LOG_APPEND_JOB_NAME, job, QUEUE_JOB_OPTIONS.transactionLogWrite).catch((error: unknown): void => {
			this.logger.warn({
				event: "transaction_log.enqueue_failed",
				correlationId: entry.correlationId,
				error: error instanceof Error ? error.message : String(error),
				fallback: "direct_write",
			});
			void this.writer.append(job.occurredAt, job.text).catch((writeError: unknown): void => {
				this.logger.error({
					event: "transaction_log.write_failed",
					correlationId: entry.correlationId,
					error: writeError instanceof Error ? writeError.message : String(writeError),
				});
			});
		});
	}
}
