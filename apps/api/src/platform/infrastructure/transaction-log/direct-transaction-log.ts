import { CaughtValueSchema } from "@workspace/shared";
import { Logger } from "@nestjs/common";

import type { HttpAuditEntry } from "../audit/http-audit-entry";
import type { TransactionLogConfig } from "../../../config/api-config.schema";
import { TransactionLogFileWriter } from "./transaction-log-file-writer";
import { DisabledTransactionLog, TransactionLog } from "./transaction-log.port";
import { caughtErrorLogFields } from "../../application/errors/caught-error-log";

/**
 * Without Redis (development, a single instance, the CLI): the entry goes
 * straight to the file writer, which appends it on the I/O thread pool after
 * the entries before it. The request does not wait for it.
 */
export class DirectTransactionLog extends TransactionLog {
	private readonly logger: Logger = new Logger(DirectTransactionLog.name);

	public constructor(private readonly writer: TransactionLogFileWriter) {
		super();
	}

	public record(entry: HttpAuditEntry): void {
		void this.writer.append(entry.occurredAt, this.writer.format(entry)).catch((error: unknown): void => {
			this.logger.error({ event: "transaction_log.write_failed", correlationId: entry.correlationId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		});
	}
}

/** The transaction log where there is no Nest container (the CLI bootstrap): direct appends, or off. */
export function standaloneTransactionLog(config: TransactionLogConfig | null): TransactionLog {
	return config === null ? new DisabledTransactionLog() : new DirectTransactionLog(new TransactionLogFileWriter(config));
}
