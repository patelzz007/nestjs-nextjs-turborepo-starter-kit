import { Module } from "@nestjs/common";

import { IdempotencyLedgerService } from "./idempotency-ledger.service";
import { IdempotencyRecordRepository } from "./idempotency-record.repository";
import { IdempotencyRetentionService } from "./idempotency-retention.service";

/** The ledger, its repository and the retention service — each declared exactly once, here. */
@Module({
	providers: [IdempotencyRecordRepository, IdempotencyLedgerService, IdempotencyRetentionService],
	exports: [IdempotencyRecordRepository, IdempotencyLedgerService, IdempotencyRetentionService],
})
export class IdempotencyCoreModule {}
