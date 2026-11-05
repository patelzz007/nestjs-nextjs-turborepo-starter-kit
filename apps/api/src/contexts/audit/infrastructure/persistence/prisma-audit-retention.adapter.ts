import { Prisma } from "@prisma/client";
import { z } from "zod";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import {
	AUDIT_RECORD_RETENTION_OPERATION,
	type AuditRetentionCount,
	type AuditRetentionPort,
	type AuditRetentionRunRecord,
	type AuditRetentionTarget,
} from "../../application/ports/audit-retention.port";
import type { SystemOperationTransactions } from "./prisma-audit-read-session";

/** `app_purge_audit_batch` returns one row of two bigints (driver: bigint). */
const PurgeRowSchema = z.object({ affected: z.bigint(), held: z.bigint() });

/** The retention store over `public.app_purge_audit_batch` (prisma/rls/70-audit-retention.sql). */
export class PrismaAuditRetentionAdapter implements AuditRetentionPort {
	public constructor(private readonly transactions: SystemOperationTransactions) {}

	public async count(actor: ActorContext, target: AuditRetentionTarget, cutoff: number): Promise<AuditRetentionCount> {
		const row = await this.call(actor, target, cutoff, 1, true, "Retention dry pass: count records past retention and under legal hold");
		return { eligible: Number(row.affected), held: Number(row.held) };
	}

	public async purgeBatch(actor: ActorContext, target: AuditRetentionTarget, cutoff: number, batchSize: number): Promise<number> {
		const row = await this.call(actor, target, cutoff, batchSize, false, "Retention: remove one batch of records past retention");
		return Number(row.affected);
	}

	public recordRun(actor: ActorContext, run: AuditRetentionRunRecord): Promise<void> {
		return this.transactions.withSystemOperation(
			{ operation: AUDIT_RECORD_RETENTION_OPERATION, reason: "Retention: record the run", actorUserId: actingUserId(actor) },
			async (tx: Prisma.TransactionClient): Promise<void> => {
				await tx.retentionRun.create({
					data: {
						target: run.target,
						cutoff: BigInt(run.cutoff),
						dryRun: run.dryRun,
						deletedCount: run.deletedCount,
						heldBackCount: run.heldBackCount,
						startedAt: BigInt(run.startedAt),
						finishedAt: BigInt(run.finishedAt),
						outcome: run.outcome,
						failureReason: run.failureReason,
					},
				});
			},
		);
	}

	private call(
		actor: ActorContext,
		target: AuditRetentionTarget,
		cutoff: number,
		batchSize: number,
		dryRun: boolean,
		reason: string,
	): Promise<z.output<typeof PurgeRowSchema>> {
		return this.transactions.withSystemOperation(
			{ operation: AUDIT_RECORD_RETENTION_OPERATION, reason, actorUserId: actingUserId(actor) },
			async (tx: Prisma.TransactionClient) => {
				const rows = await tx.$queryRaw(Prisma.sql`SELECT affected, held FROM public.app_purge_audit_batch(${target}, ${BigInt(cutoff)}, ${batchSize}::integer, ${dryRun})`);
				const [row] = z.array(PurgeRowSchema).length(1).parse(rows);
				return PurgeRowSchema.parse(row);
			},
		);
	}
}
