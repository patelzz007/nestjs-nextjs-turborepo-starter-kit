import { Injectable } from "@nestjs/common";
import type { AclEffect, Prisma, ResourceAcl } from "@prisma/client";
import type { AuthorizationRequest, PermissionAction, PermissionResource, PermissionScope } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
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
	readonly organizationId?: string;
	readonly locationId?: string;
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
	readonly organizationId?: string;
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

/**
 * ACL Service — resource-level ALLOW/DENY exceptions (spec §38, §124).
 *
 * Matching rules:
 * - subject: the user directly, or any of the user's active (inherited) roles
 * - action: the exact action or `MANAGE`
 * - resource id: an entry without `resourceId` applies to every resource of the type
 * - tenant: an entry bound to an organization/location only applies inside that
 *   server-verified tenant
 * - conditions: evaluated with the policy DSL; malformed DENY conditions fail closed
 * - expired / soft-deleted entries never match
 */
@Injectable()
export class AclService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly policyEngine: PolicyEngineService,
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

		const entries = await this.prisma.resourceAcl.findMany({
			where: {
				isDeleted: false,
				action: { in: lookup.action === "MANAGE" ? ["MANAGE"] : [lookup.action, "MANAGE"] },
				resourceType: lookup.resource,
				AND: [
					{ OR: subjects },
					{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
					{ OR: [{ organizationId: null }, ...(lookup.organizationId === undefined ? [] : [{ organizationId: lookup.organizationId }])] },
					{ OR: [{ locationId: null }, ...(lookup.locationId === undefined ? [] : [{ locationId: lookup.locationId }])] },
					resourceIdFilter(lookup.resourceScope),
				],
			},
			orderBy: { createdAt: "desc" },
		});

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
		return this.prisma.resourceAcl.create({
			data: {
				subjectType: data.subjectType,
				subjectId: data.subjectId,
				action: data.action,
				resourceType: data.resourceType,
				resourceId: data.resourceId ?? null,
				effect: data.effect,
				scope: data.scope ?? null,
				organizationId: data.organizationId ?? null,
				locationId: data.locationId ?? null,
				reason: data.reason ?? null,
				assignedBy: data.assignedBy ?? null,
				expiresAt: data.expiresAt ?? null,
			},
		});
	}

	/** Soft delete an entry. */
	public async removeAcl(id: string): Promise<void> {
		await this.prisma.resourceAcl.update({
			where: { id },
			data: { isDeleted: true, deletedAt: Date.now() },
		});
	}

	public async listAcls(subjectId: string, subjectType: "USER" | "ROLE"): Promise<ResourceAcl[]> {
		return this.prisma.resourceAcl.findMany({
			where: { subjectType, subjectId, isDeleted: false },
			orderBy: { createdAt: "desc" },
		});
	}
}
