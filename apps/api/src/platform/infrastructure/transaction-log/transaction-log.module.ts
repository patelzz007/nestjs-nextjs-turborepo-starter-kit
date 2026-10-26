import { Module, type DynamicModule } from "@nestjs/common";

import { getApiConfig } from "../../../config/api-config";
import { DirectTransactionLog } from "./direct-transaction-log";
import { QueuedTransactionLog } from "./queued-transaction-log";
import { TransactionLogFileWriter } from "./transaction-log-file-writer";
import { TRANSACTION_LOG_FILE_WRITER_PROVIDER } from "./transaction-log-file-writer.provider";
import { TransactionLogRetentionScheduler } from "./transaction-log-retention.scheduler";
import { TransactionLogWriteProcessor } from "./transaction-log-write.processor";
import { DisabledTransactionLog, TransactionLog } from "./transaction-log.port";

/** On, with Redis: entries go through the `transaction-log.write` queue to its worker. */
@Module({
	providers: [
		TRANSACTION_LOG_FILE_WRITER_PROVIDER,
		QueuedTransactionLog,
		{ provide: TransactionLog, useExisting: QueuedTransactionLog },
		TransactionLogWriteProcessor,
		TransactionLogRetentionScheduler,
	],
	exports: [TransactionLog],
})
export class TransactionLogQueueModule {}

/** On, without Redis: entries are appended directly, asynchronously. */
@Module({
	providers: [
		TRANSACTION_LOG_FILE_WRITER_PROVIDER,
		{ provide: TransactionLog, useFactory: (writer: TransactionLogFileWriter): TransactionLog => new DirectTransactionLog(writer), inject: [TransactionLogFileWriter] },
		TransactionLogRetentionScheduler,
	],
	exports: [TransactionLog],
})
export class TransactionLogDirectModule {}

/** Off (TRANSACTION_LOG_ENABLED=false, and the default under tests). */
@Module({
	providers: [{ provide: TransactionLog, useClass: DisabledTransactionLog }],
	exports: [TransactionLog],
})
export class TransactionLogDisabledModule {}

type TransactionLogStrategyModule = typeof TransactionLogQueueModule | typeof TransactionLogDirectModule | typeof TransactionLogDisabledModule;

/** The strategy for the validated config (parsed by main.ts first), like every other queue module. */
function strategyModule(): TransactionLogStrategyModule {
	const { observability, messaging } = getApiConfig();
	if (observability.transactionLog === null) {
		return TransactionLogDisabledModule;
	}
	return messaging.redisUrl !== undefined ? TransactionLogQueueModule : TransactionLogDirectModule;
}

/**
 * The plain-text transaction log (`TransactionLog`, docs/technical/operations/transaction-log.md):
 * off → a no-op; on with Redis → BullMQ and its worker; on without Redis →
 * direct, asynchronous appends. Imported by `AuditLogModule`, whose
 * `AuditTrailService` hands it every audit row.
 */
@Module({})
export class TransactionLogModule {
	public static register(): DynamicModule {
		const strategy: TransactionLogStrategyModule = strategyModule();
		return { module: TransactionLogModule, imports: [strategy], exports: [strategy] };
	}
}
