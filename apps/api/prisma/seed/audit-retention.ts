// The audit-retention seed (ADR 078): legal holds and the retention run log, so the operations console and
// the retention job have real rows to show, and every column holds a value (seed coverage).
import type { RetentionRunOutcome, RetentionTarget } from "@prisma/client";
import { DAY_MS } from "@workspace/shared";

import { RECORD_RETENTION_MS } from "../../src/platform/domain/record-retention";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";

const NAMESPACE = "audit-retention";
/** A minute: how long the seeded runs took. */
const MINUTE_MS = 60_000;

/** One seeded retention run. */
interface SeedRun {
	readonly key: string;
	readonly target: RetentionTarget;
	readonly dryRun: boolean;
	readonly startedAt: number;
	readonly deletedCount: number;
	readonly heldBackCount: number;
	readonly outcome: RetentionRunOutcome;
	readonly failureReason: string | null;
}

export interface AuditRetentionSeedResult {
	readonly holds: number;
	readonly runs: number;
}

/**
 * Two legal holds (Brew & Bean KL under an active hold for a dispute; a lifted hold on one user) and three
 * retention runs (last week's dry run, the real run after it, and a failed run), for both audit tables.
 */
export async function seedAuditRetention(now: number): Promise<AuditRetentionSeedResult> {
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { email: "superadmin@example.com", isDeleted: false }, select: { id: true } });
	const customer = await prisma.user.findFirstOrThrow({ where: { email: "alice.johnson@example.com", isDeleted: false }, select: { id: true } });

	const holds = [
		{
			id: deterministicUuid(NAMESPACE, "hold:kl-dispute"),
			tenantId: TENANT_SEED_IDS.klTenant,
			userId: null,
			reason: "Chargeback dispute with the card scheme: keep Brew & Bean KL's records until it is closed.",
			placedByUserId: superAdmin.id,
			placedAt: now - 20 * DAY_MS,
			liftedAt: null,
			liftedByUserId: null,
		},
		{
			id: deterministicUuid(NAMESPACE, "hold:alice-request"),
			tenantId: TENANT_SEED_IDS.klTenant,
			userId: customer.id,
			reason: "Records requested by the customer's lawyer; released once the copy was sent.",
			placedByUserId: superAdmin.id,
			placedAt: now - 90 * DAY_MS,
			liftedAt: now - 60 * DAY_MS,
			liftedByUserId: superAdmin.id,
		},
	];
	for (const { id, ...row } of holds) {
		const data = { ...row, placedAt: BigInt(row.placedAt), liftedAt: row.liftedAt === null ? null : BigInt(row.liftedAt) };
		await prisma.auditLegalHold.upsert({ where: { id }, create: { id, ...data }, update: data });
	}

	const lastWeek = now - 7 * DAY_MS;
	const cutoffOf = (at: number): number => at - RECORD_RETENTION_MS;
	const runs: readonly SeedRun[] = [
		{ key: "dry-audit-log", target: "AUDIT_LOG", dryRun: true, startedAt: lastWeek, deletedCount: 0, heldBackCount: 0, outcome: "COMPLETED", failureReason: null },
		{
			key: "real-audit-log",
			target: "AUDIT_LOG",
			dryRun: false,
			startedAt: lastWeek + MINUTE_MS,
			deletedCount: 0,
			heldBackCount: 0,
			outcome: "COMPLETED",
			failureReason: null,
		},
		{
			key: "failed-data-change-log",
			target: "DATA_CHANGE_LOG",
			dryRun: false,
			startedAt: lastWeek + 2 * MINUTE_MS,
			deletedCount: 0,
			heldBackCount: 0,
			outcome: "FAILED",
			failureReason: "canceling statement due to statement timeout (the next weekly run continued where it stopped)",
		},
	];
	// The run log is append-only (no UPDATE for the application role), so it is seeded insert-only: a
	// re-seed keeps the rows already there.
	await prisma.retentionRun.createMany({
		skipDuplicates: true,
		data: runs.map((run) => ({
			id: deterministicUuid(NAMESPACE, `run:${run.key}`),
			target: run.target,
			cutoff: BigInt(cutoffOf(run.startedAt)),
			dryRun: run.dryRun,
			deletedCount: run.deletedCount,
			heldBackCount: run.heldBackCount,
			startedAt: BigInt(run.startedAt),
			finishedAt: BigInt(run.startedAt + MINUTE_MS),
			outcome: run.outcome,
			failureReason: run.failureReason,
		})),
	});
	return { holds: holds.length, runs: runs.length };
}
