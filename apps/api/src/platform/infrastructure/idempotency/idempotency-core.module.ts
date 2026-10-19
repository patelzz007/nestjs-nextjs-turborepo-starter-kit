import { Module } from "@nestjs/common";

import { IDEMPOTENCY_KEY_LOCKS } from "./idempotency-key-locks";
import { IdempotencyLedgerService } from "./idempotency-ledger.service";
import { IdempotencyRecordRepository } from "./idempotency-record.repository";
import { IdempotencyRetentionService } from "./idempotency-retention.service";
import { PostgresIdempotencyKeyLocks } from "./postgres-idempotency-key-locks";

/** The ledger, its repository, the key locks and the retention service — each declared exactly once, here. */
@Module({
	providers: [
		IdempotencyRecordRepository,
		PostgresIdempotencyKeyLocks,
		{ provide: IDEMPOTENCY_KEY_LOCKS, useExisting: PostgresIdempotencyKeyLocks },
		IdempotencyLedgerService,
		IdempotencyRetentionService,
	],
	exports: [IdempotencyRecordRepository, IdempotencyLedgerService, IdempotencyRetentionService],
})
export class IdempotencyCoreModule {}
