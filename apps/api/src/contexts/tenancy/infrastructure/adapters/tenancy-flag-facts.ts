import type { SubjectFactSource } from "../../../feature-flags/public-api";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { FlagFactTransactions } from "../../../../platform/infrastructure/persistence/flag-fact-transactions";

/** The one written copy of the operation name (`system-operation-single-source.spec.ts`). */
const TENANCY_FLAG_FACTS_OPERATION: SystemOperationName = "tenancy.flag_facts.read";

/**
 * Tenancy's part of the facts feature flags read (ADR 087): whether a person works at a store — an active
 * membership of the tenant and, for a location, a live scope covering every location or that one.
 */
export function tenancyFlagFacts(transactions: FlagFactTransactions): SubjectFactSource {
	return {
		worksAt: (userId: string, tenantId: string, locationId: string | null): Promise<boolean> =>
			transactions.withSystemOperation(
				{ operation: TENANCY_FLAG_FACTS_OPERATION, reason: "Feature flags: does the person work at this store", actorUserId: userId },
				async (tx) => {
					const membership = await tx.membership.findFirst({ where: { userId, tenantId, isDeleted: false, status: "ACTIVE" }, select: { id: true } });
					if (membership === null) {
						return false;
					}
					if (locationId === null) {
						return true;
					}
					const scopes = await tx.membershipLocationScope.count({
						where: { tenantId, membershipId: membership.id, isDeleted: false, OR: [{ scopeType: "ALL_LOCATIONS" }, { scopeType: "SELECTED", locationId }] },
					});
					return scopes > 0;
				},
			),
	};
}
