import type { Prisma } from "@prisma/client";
import { epochMs, TenantLifecycleResponseSchema, UuidParamSchema, type TenantLifecycleResponse } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TENANT_LIFECYCLE_APPEAL_LIMIT, type TenantLifecycleReadPort } from "../../application/ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_READ_OPERATION } from "../../application/ports/tenants.tokens";

/** The read transaction the lifecycle routes run their reads in. */
interface LifecycleReadTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

function epochOrNull(value: bigint | null): number | null {
	return value === null ? null : epochMs(Number(value));
}

export class PrismaTenantLifecycleReadRepository implements TenantLifecycleReadPort {
	public constructor(private readonly transactions: LifecycleReadTransactions) {}

	public findMemberTenantId(routeKey: string, userId: string): Promise<string | null> {
		return this.transactions.withSystemOperation(
			{ operation: TENANT_LIFECYCLE_READ_OPERATION, reason: "Resolve the tenant of a lifecycle route for an active member", actorUserId: userId },
			async (db) => {
				const tenant = await db.tenant.findFirst({
					where: {
						isDeleted: false,
						lifecycleState: { not: "DELETED" },
						OR: [{ slug: routeKey }, { slugHistory: { some: { slug: routeKey } } }, ...(UuidParamSchema.safeParse(routeKey).success ? [{ id: routeKey }] : [])],
						memberships: { some: { userId, status: "ACTIVE", isDeleted: false } },
					},
					select: { id: true },
				});
				return tenant?.id ?? null;
			},
		);
	}

	public findLifecycle(tenantId: string): Promise<TenantLifecycleResponse | null> {
		return this.transactions.withSystemOperation(
			{ operation: TENANT_LIFECYCLE_READ_OPERATION, reason: "Read a tenant's lifecycle, suspension, ban and appeals", actorUserId: null },
			async (db) => {
				const tenant = await db.tenant.findFirst({
					where: { id: tenantId, isDeleted: false, lifecycleState: { not: "DELETED" } },
					select: {
						id: true,
						lifecycleState: true,
						deletionGraceEndsAt: true,
						// The latest move into a suspension or a ban: it explains the current state when the state is that one.
						lifecycleEvents: {
							where: { toState: { in: ["SUSPENDED", "BANNED"] }, isDeleted: false },
							orderBy: { createdAt: "desc" },
							take: 1,
							select: { toState: true, reason: true, createdAt: true },
						},
						suspensionAppeals: {
							where: { isDeleted: false },
							orderBy: [{ createdAt: "desc" }, { id: "desc" }],
							take: TENANT_LIFECYCLE_APPEAL_LIMIT,
							select: {
								id: true,
								status: true,
								message: true,
								createdAt: true,
								reviewedAt: true,
								reviewNote: true,
								submittedBy: { select: { id: true, fullName: true } },
							},
						},
					},
				});
				if (tenant === null) {
					return null;
				}
				const [latest] = tenant.lifecycleEvents;
				// The latest suspension or ban explains the state only while the tenant is still in it.
				const cause = latest?.toState === tenant.lifecycleState ? latest : undefined;
				return TenantLifecycleResponseSchema.parse({
					tenantId: tenant.id,
					lifecycleState: tenant.lifecycleState,
					deletionGraceEndsAt: epochOrNull(tenant.deletionGraceEndsAt),
					suspension: cause?.toState === "SUSPENDED" ? { suspendedAt: epochMs(Number(cause.createdAt)), reason: cause.reason } : null,
					ban: cause?.toState === "BANNED" ? { bannedAt: epochMs(Number(cause.createdAt)), reason: cause.reason } : null,
					appeals: tenant.suspensionAppeals.map((appeal) => ({
						id: appeal.id,
						status: appeal.status,
						message: appeal.message,
						submittedBy: appeal.submittedBy,
						createdAt: epochMs(Number(appeal.createdAt)),
						reviewedAt: epochOrNull(appeal.reviewedAt),
						reviewNote: appeal.reviewNote,
					})),
				});
			},
		);
	}
}
