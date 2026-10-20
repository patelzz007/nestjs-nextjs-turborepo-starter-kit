import { Inject, Injectable } from "@nestjs/common";
import type { AclEffect, Prisma, ResourceAcl } from "@prisma/client";
import type { AuthorizationRequest, PermissionAction, PermissionResource, PermissionScope } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PolicyEngineService } from "./policy-engine.service";

/**
 * - `resource` — entries for that resource id **or** type-wide entries (`resourceId = null`)
 * - `typeWide` — type-wide entries only (collection-level capability check)
 * - `everyResource` — every entry of the type (used to build list filters)
 */
export type AclResourceScope = { readonly kind: "resource"; readonly id: string } | { readonly kind: "typeWide" } | { readonly kind: "everyResource" };

export interface AclLookup {
	readonly userId: string;
	/** Active role ids (including inherited) — ROLE-subject entries match these. */
	readonly roleIds: readonly string[];
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	/** Which entries to consider — see {@link AclResourceScope}. */
	readonly resourceScope: AclResourceScope;
	/** Server-verified tenant; org/location-bound entries only apply inside it. */
	readonly tenantId?: string | undefined;
	readonly locationId?: string | undefined;
}

export interface AclMatches {
	readonly denies: readonly ResourceAcl[];
	readonly allows: readonly ResourceAcl[];
}

export interface CreateAclInput {
	readonly subjectType: "USER" | "ROLE";
	readonly subjectId: string;
	readonly action: PermissionAction;
	readonly resourceType: PermissionResource;
	readonly resourceId?: string;
	readonly effect: AclEffect;
	readonly scope?: PermissionScope;
	readonly tenantId?: string;
	readonly locationId?: string;
	readonly reason?: string;
	readonly assignedBy?: string;
	readonly expiresAt?: number;
}

function resourceIdFilter(scope: AclResourceScope): Prisma.ResourceAclWhereInput {
	switch (scope.kind) {
		case "everyResource":
			return {};
		case "typeWide":
			return { resourceId: null };
		case "resource":
			return { OR: [{ resourceId: null }, { resourceId: scope.id }] };
	}
}

/** Access-control reads an authorization decision makes before the handler's RLS scope exists. */
interface AclMatchTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * ACL Service — resource-level ALLOW/DENY exceptions (spec §38, §124).
 *
 * Matching rules:
 * - subject: the user directly, or any of the user's active (inherited) roles
 * - action: the exact action or `MANAGE`
 * - resource id: an entry without `resourceId` applies to every resource of the type
 * - tenant: an entry bound to a tenant/location only applies inside that
 *   server-verified tenant
 * - conditions: evaluated with the policy DSL; malformed DENY conditions fail closed
 * - expired / soft-deleted entries never match
 */
@Injectable()
export class AclService {
	public constructor(
		private readonly policyEngine: PolicyEngineService,
		@Inject(TenantTransactionService) private readonly transactions: AclMatchTransactions,
	) {}

	/** Every applicable entry in one query, split by effect. */
	public async findApplicable(lookup: AclLookup, request: AuthorizationRequest): Promise<AclMatches> {
		const now = Date.now();
		const subjects: ({ subjectType: "USER"; subjectId: string } | { subjectType: "ROLE"; subjectId: { in: string[] } })[] = [
			{ subjectType: "USER", subjectId: lookup.userId },
		];
		if (lookup.roleIds.length > 0) {
			subjects.push({ subjectType: "ROLE", subjectId: { in: [...lookup.roleIds] } });
		}

		const entries = await this.transactions.withSystemOperation(
			{ operation: "authorization.acl.match", reason: "Read resource access-control entries for an authorization decision", actorUserId: lookup.userId },
			(tx) =>
				tx.resourceAcl.findMany({
					where: {
						isDeleted: false,
						action: { in: lookup.action === "MANAGE" ? ["MANAGE"] : [lookup.action, "MANAGE"] },
						resourceType: lookup.resource,
						AND: [
							{ OR: subjects },
							{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
							{ OR: [{ tenantId: null }, ...(lookup.tenantId === undefined ? [] : [{ tenantId: lookup.tenantId }])] },
							{ OR: [{ locationId: null }, ...(lookup.locationId === undefined ? [] : [{ locationId: lookup.locationId }])] },
							resourceIdFilter(lookup.resourceScope),
						],
					},
					orderBy: { createdAt: "desc" },
				}),
		);

		const denies: ResourceAcl[] = [];
		const allows: ResourceAcl[] = [];
		for (const entry of entries) {
			const isDeny = entry.effect === "DENY";
			if (!this.policyEngine.matchesStoredConditions(entry.conditions, request, isDeny)) {
				continue;
			}
			if (isDeny) {
				denies.push(entry);
			} else {
				allows.push(entry);
			}
		}
		return { denies, allows };
	}

	public async createAcl(data: CreateAclInput): Promise<ResourceAcl> {
		return this.transactions.withSystemOperation(
			{ operation: "authorization.acl.write", reason: "Create a resource access-control entry", actorUserId: data.assignedBy ?? null },
			(tx) =>
				tx.resourceAcl.create({
					data: {
						subjectType: data.subjectType,
						subjectId: data.subjectId,
						action: data.action,
						resourceType: data.resourceType,
						resourceId: data.resourceId ?? null,
						effect: data.effect,
						scope: data.scope ?? null,
						tenantId: data.tenantId ?? null,
						locationId: data.locationId ?? null,
						reason: data.reason ?? null,
						assignedBy: data.assignedBy ?? null,
						expiresAt: data.expiresAt ?? null,
					},
				}),
		);
	}

	/** Soft delete an entry. */
	public async removeAcl(id: string): Promise<void> {
		await this.transactions.withSystemOperation({ operation: "authorization.acl.write", reason: "Soft-delete a resource access-control entry", actorUserId: null }, (tx) =>
			tx.resourceAcl.update({ where: { id }, data: { isDeleted: true, deletedAt: Date.now() } }),
		);
	}

	public async listAcls(subjectId: string, subjectType: "USER" | "ROLE"): Promise<ResourceAcl[]> {
		return this.transactions.withSystemOperation(
			{ operation: "authorization.acl.write", reason: "List a subject's resource access-control entries", actorUserId: subjectType === "USER" ? subjectId : null },
			(tx) => tx.resourceAcl.findMany({ where: { subjectType, subjectId, isDeleted: false }, orderBy: { createdAt: "desc" } }),
		);
	}
}
