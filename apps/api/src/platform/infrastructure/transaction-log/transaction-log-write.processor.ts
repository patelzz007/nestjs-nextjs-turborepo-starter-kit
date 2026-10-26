import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUE_NAMES, TransactionLogWriteJobSchema } from "@workspace/shared";
import type { Job } from "bullmq";

import { TransactionLogFileWriter } from "./transaction-log-file-writer";

/** The one job field the processor reads. */
export type TransactionLogWriteExecution = Pick<Job, "data">;

/**
 * `transaction-log.write` worker: appends one queued entry to its day file.
 * A failed write throws, so BullMQ retries it per the `transactionLogWrite`
 * preset; a job that runs out of attempts stays in the failed set (Bull Board)
 * to be replayed. The queue-wide concurrency of one keeps the file in order.
 */
@Processor(QUEUE_NAMES.transactionLogWrite)
@Injectable()
export class TransactionLogWriteProcessor extends WorkerHost {
	public constructor(private readonly writer: TransactionLogFileWriter) {
		super();
	}

	public async process(job: TransactionLogWriteExecution): Promise<void> {
		const { occurredAt, text } = TransactionLogWriteJobSchema.parse(job.data);
		await this.writer.append(occurredAt, text);
	}
}
