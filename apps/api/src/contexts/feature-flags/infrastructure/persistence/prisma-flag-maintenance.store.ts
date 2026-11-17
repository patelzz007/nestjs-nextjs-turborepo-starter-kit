import { RevisionContentSchema } from "@workspace/shared";

import { FEATURE_FLAGS_MAINTENANCE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { FlagMaintenanceStore } from "../../application/ports/flag-maintenance.store";
import { bumpCatalogVersion, type FlagTransactions } from "./flag-transactions";

/** `FlagMaintenanceStore` over Prisma, under `queue.feature_flags.maintenance` (no person acts). */
export class PrismaFlagMaintenanceStore implements FlagMaintenanceStore {
	public constructor(private readonly transactions: FlagTransactions) {}

	public expirePending(at: number): Promise<number> {
		return this.transactions.withSystemOperation(
			{ operation: FEATURE_FLAGS_MAINTENANCE_OPERATION, reason: "Feature flags: expire pending revisions past their week", actorUserId: null },
			async (tx) =>
				(await tx.flagRevision.updateMany({ where: { status: "PENDING", expiresAt: { lte: BigInt(at) } }, data: { status: "EXPIRED", decidedAt: BigInt(at) } })).count,
		);
	}

	public bumpForStepsBetween(from: number, to: number): Promise<number | null> {
		return this.transactions.withSystemOperation(
			{ operation: FEATURE_FLAGS_MAINTENANCE_OPERATION, reason: "Feature flags: a scheduled rollout reached a step", actorUserId: null },
			async (tx) => {
				const live = await tx.flagRevision.findMany({ where: { status: "LIVE" }, select: { content: true } });
				const stepReached = live.some((row) =>
					RevisionContentSchema.parse(row.content).rules.some(
						(rule) => rule.rollout.kind === "SCHEDULED" && rule.rollout.steps.some((step) => step.at > from && step.at <= to),
					),
				);
				return stepReached ? bumpCatalogVersion(tx) : null;
			},
		);
	}
}
