import { Injectable } from "@nestjs/common";
import type {
	AuthorizationAttributes,
	AuthorizationContext,
	AuthorizationDecision,
	AuthorizationEvaluationStep,
	AuthorizationRequest,
	AuthorizationResult,
	AuthorizationRowFilter,
	BaseRowFilter,
	PermissionAction,
	PermissionPair,
	PermissionResource,
	ResourceAuthorization,
	ResourceCapabilityMap,
	RowScopeAlternative,
} from "@workspace/shared";
import { isStringPrimitive, PermissionPairSchema, withResourceCapability } from "@workspace/shared";

import { AuthorizationException } from "../exceptions/authorization.exception";
import { AclService } from "./acl.service";
import { AuthorizationAuditKernelService, type AuthorizationAuditMetadata } from "./authorization-audit-kernel.service";
import { PolicyEngineService } from "./policy-engine.service";
import { ResourceOwnershipResolver, type OwnershipLookup } from "./resource-ownership.resolver";
import { grantsFor, SubjectGrantsLoader, type SubjectGrant } from "./subject-grants.loader";
import { TenantMembershipService, type RequestedTenant, type TenantVerification, type VerifiedTenantContext } from "./tenant-membership.service";

const ALL_ACTIONS: readonly PermissionAction[] = ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"];

/** Tenant ids the subject claims — verified by `TenantMembershipService` before any use. */
function requestedTenant(subject: AuthorizationContext): RequestedTenant {
	return {
		...(subject.organizationId === undefined ? {} : { organizationId: subject.organizationId }),
		...(subject.storeId === undefined ? {} : { storeId: subject.storeId }),
		...(subject.locationId === undefined ? {} : { locationId: subject.locationId }),
	};
}

/** Replace claimed tenant ids with the verified ones (unverified ids are dropped). */
function withVerifiedTenant(subject: AuthorizationContext, verified: VerifiedTenantContext): AuthorizationContext {
	return { ...subject, organizationId: verified.organizationId, storeId: verified.storeId, locationId: verified.locationId };
}

function tenantRejectionReason(tenant: TenantVerification): string | null {
	if (tenant.organizationRejected) {
		return "Subject is not an active member of the requested organization";
	}
	if (tenant.storeRejected) {
		return "Subject cannot act in the requested store";
	}
	if (tenant.locationRejected) {
		return "Requested location is outside the subject's membership scope";
	}
	return null;
}

/** Matches no rows — used whenever a list request holds no applicable grant. */
function denyAllRows(): AuthorizationRowFilter {
	return { id: { in: [] } };
}

function readStringAttribute(attributes: AuthorizationAttributes | undefined, key: string): string | undefined {
	const value = attributes?.[key];
	return isStringPrimitive(value) ? value : undefined;
}

interface ScopeOutcome {
	readonly satisfied: boolean;
	readonly reason: string;
}

/**
 * Authorization Kernel — the single decision point for backend authorization.
 *
 * Public API: `can()`, `authorize()`, `explain()`, `filter()`,
 * `resourceCapabilities()`, `hasRoles()`.
 *
 * Decision precedence (spec §65, default deny):
 *
 *  1. SuperAdmin platform bypass (explicit, audited by the guard)
 *  2. Unknown action/resource → DENY (fail closed)
 *  3. Tenant verification — a claimed organization/location the subject is not an
 *     active member of → DENY (forged tenant ids never reach later steps)
 *  4. Explicit DENY — per-user override or ACL entry → DENY
 *  5. Explicit ACL ALLOW → ALLOW
 *  6. Grants (roles incl. hierarchy, user ALLOW overrides, implicit self grants)
 *     must match the action (MANAGE implies all) **and** satisfy their scope:
 *       GLOBAL · ORGANIZATION (verified membership, same-org resource)
 *       · LOCATION (verified location scope) · OWN (DB-resolved owner) · RESOURCE (ACL only)
 *  7. Conditional policies (ABAC) — a matching DENY or unmet conditional ALLOW → DENY
 *  8. Default → DENY
 *
 * Organization membership (ReBAC) never grants permissions on its own; it only
 * satisfies the ORGANIZATION / LOCATION scope of a permission the subject holds.
 * PostgreSQL RLS remains the final row boundary beneath every decision.
 */
@Injectable()
export class AuthorizationKernelService {
	public constructor(
		private readonly grantsLoader: SubjectGrantsLoader,
		private readonly tenantMembership: TenantMembershipService,
		private readonly ownership: ResourceOwnershipResolver,
		private readonly aclService: AclService,
		private readonly policyEngine: PolicyEngineService,
		private readonly audit: AuthorizationAuditKernelService,
	) {}

	/** Boolean decision, no side effects. */
	public async can(request: AuthorizationRequest): Promise<AuthorizationDecision> {
		const result = await this.explain(request);
		return result.decision;
	}

	/**
	 * Security-boundary check: audits the decision (DENY / writes / sensitive
	 * reads) and throws the structured 403 when denied. The exception never
	 * reveals which rule failed — use `explain()` for internal debugging.
	 */
	public async authorize(request: AuthorizationRequest, metadata?: AuthorizationAuditMetadata): Promise<void> {
		const result = await this.explain(request);
		await this.audit.auditResult(result, metadata);
		if (result.decision === "DENY") {
			throw new AuthorizationException();
		}
	}

	/** Full decision with ordered evaluation steps. */
	public async explain(request: AuthorizationRequest): Promise<AuthorizationResult> {
		const startedAt = Date.now();
		const evaluation: AuthorizationEvaluationStep[] = [];
		const finish = (decision: AuthorizationDecision, evaluated: AuthorizationRequest): AuthorizationResult => ({
			decision,
			request: evaluated,
			evaluation,
			durationMs: Date.now() - startedAt,
		});

		if (request.subject.isSuperAdmin === true) {
			evaluation.push({ source: "superadmin", effect: "ALLOW", reason: "Platform SuperAdmin bypass" });
			return finish("ALLOW", request);
		}

		const pair = PermissionPairSchema.safeParse({ action: request.action, resource: request.resource });
		if (!pair.success) {
			evaluation.push({ source: "validation", effect: "DENY", reason: "Unknown action or resource" });
			return finish("DENY", request);
		}
		const required: PermissionPair = pair.data;

		// ── Tenant verification (relationship: user → member → org → store → location) ──
		const tenant = await this.tenantMembership.verify(request.subject.userId, requestedTenant(request.subject));
		const rejection = tenantRejectionReason(tenant);
		if (rejection !== null) {
			evaluation.push({ source: "tenant", effect: "DENY", reason: rejection });
			return finish("DENY", request);
		}
		const evaluated: AuthorizationRequest = { ...request, subject: withVerifiedTenant(request.subject, tenant.context) };
		if (tenant.context.organizationId !== undefined) {
			evaluation.push({
				source: "relationship",
				effect: "NO_MATCH",
				reason: "Verified active organization membership",
				details: { organizationId: tenant.context.organizationId },
			});
		}

		const subjectGrants = await this.grantsLoader.load(request.subject.userId);

		// ── Explicit DENY: user overrides ──
		const deniedBy = grantsFor(subjectGrants.denials, required);
		const denial = deniedBy.at(0);
		if (denial !== undefined) {
			evaluation.push({ source: "override", effect: "DENY", reason: "Explicit per-user DENY override", details: { overrideId: denial.sourceId } });
			return finish("DENY", evaluated);
		}

		// ── Explicit ACL DENY / ALLOW ──
		const acl = await this.aclService.findApplicable(
			{
				userId: request.subject.userId,
				roleIds: subjectGrants.roleIds,
				action: required.action,
				resource: required.resource,
				resourceScope: request.resourceId === undefined ? { kind: "typeWide" } : { kind: "resource", id: request.resourceId },
				organizationId: tenant.context.organizationId,
				locationId: tenant.context.locationId,
			},
			evaluated,
		);
		const aclDeny = acl.denies.at(0);
		if (aclDeny !== undefined) {
			evaluation.push({ source: "acl", effect: "DENY", reason: `Explicit ACL DENY${aclDeny.reason === null ? "" : `: ${aclDeny.reason}`}`, details: { aclId: aclDeny.id } });
			return finish("DENY", evaluated);
		}
		const aclAllow = acl.allows.at(0);
		if (aclAllow !== undefined) {
			evaluation.push({
				source: "acl",
				effect: "ALLOW",
				reason: `Explicit ACL ALLOW${aclAllow.reason === null ? "" : `: ${aclAllow.reason}`}`,
				details: { aclId: aclAllow.id },
			});
			return finish("ALLOW", evaluated);
		}
		evaluation.push({ source: "acl", effect: "NO_MATCH", reason: "No explicit ACL entry" });

		// ── Grants + scope ──
		const candidates = grantsFor(subjectGrants.grants, required);
		if (candidates.length === 0) {
			evaluation.push({ source: "role", effect: "NO_MATCH", reason: "Subject holds no grant for this permission" });
			evaluation.push({ source: "default", effect: "DENY", reason: "No authorization rule matched — default deny" });
			return finish("DENY", evaluated);
		}

		let ownershipLookup: OwnershipLookup | undefined;
		const resolveOwnership = async (): Promise<OwnershipLookup> => {
			ownershipLookup ??= request.resourceId === undefined ? { kind: "missing" } : await this.ownership.resolve(required.resource, request.resourceId);
			return ownershipLookup;
		};

		let satisfiedBy: SubjectGrant | undefined;
		const scopeReasons: string[] = [];
		for (const grant of candidates) {
			const scopeOutcome = await this.evaluateScope(grant, evaluated, resolveOwnership);
			const outcome: ScopeOutcome =
				scopeOutcome.satisfied && !this.policyEngine.matchesStoredConditions(grant.conditions, evaluated, false)
					? { satisfied: false, reason: "Permission conditions not met" }
					: scopeOutcome;
			if (outcome.satisfied) {
				satisfiedBy = grant;
				evaluation.push({
					source: grant.scope === "OWN" ? "ownership" : "scope",
					effect: "ALLOW",
					reason: outcome.reason,
					details: { grantSource: grant.source, grantScope: grant.scope },
				});
				break;
			}
			scopeReasons.push(outcome.reason);
		}

		if (satisfiedBy === undefined) {
			evaluation.push({ source: "scope", effect: "DENY", reason: scopeReasons.join("; ") });
			evaluation.push({ source: "default", effect: "DENY", reason: "No grant applies in this scope — default deny" });
			return finish("DENY", evaluated);
		}
		evaluation.push({
			source: "role",
			effect: "ALLOW",
			reason: satisfiedBy.source === "role" ? "Granted via role" : satisfiedBy.source === "override" ? "Granted via user override" : "Implicit self grant",
		});

		// ── Conditional policies ──
		const policy = await this.policyEngine.evaluate(evaluated);
		evaluation.push(...policy.evaluation);
		if (policy.decision === "DENY") {
			return finish("DENY", evaluated);
		}

		return finish("ALLOW", evaluated);
	}

	/**
	 * Translate the subject's grants into a Prisma WHERE fragment for list
	 * endpoints (spec §32, §57). Conventions: tenant rows expose
	 * `organizationId` / `locationId`, owned rows expose `userId` (the USER /
	 * PROFILE resources use their primary key). Row-level ABAC conditions are
	 * enforced per operation via `authorize()`; an unconditional DENY policy
	 * yields no rows. RLS still applies beneath this filter.
	 */
	public async filter(context: AuthorizationContext, action: PermissionAction, resource: PermissionResource): Promise<AuthorizationRowFilter> {
		if (context.isSuperAdmin === true) {
			return {};
		}

		const tenant = await this.tenantMembership.verify(context.userId, requestedTenant(context));
		if (tenantRejectionReason(tenant) !== null) {
			return denyAllRows();
		}
		const verified: AuthorizationContext = withVerifiedTenant(context, tenant.context);
		const required: PermissionPair = { action, resource };
		const request: AuthorizationRequest = { subject: verified, action, resource };

		const subjectGrants = await this.grantsLoader.load(context.userId);
		if (grantsFor(subjectGrants.denials, required).length > 0) {
			return denyAllRows();
		}

		if (await this.policyEngine.hasUnconditionalDeny(request)) {
			return denyAllRows();
		}

		const acl = await this.aclService.findApplicable(
			{
				userId: context.userId,
				roleIds: subjectGrants.roleIds,
				action,
				resource,
				resourceScope: { kind: "everyResource" },
				organizationId: tenant.context.organizationId,
				locationId: tenant.context.locationId,
			},
			request,
		);
		if (acl.denies.some((entry) => entry.resourceId === null)) {
			return denyAllRows();
		}

		const alternatives: RowScopeAlternative[] = [];
		let unrestricted = acl.allows.some((entry) => entry.resourceId === null);

		for (const grant of grantsFor(subjectGrants.grants, required)) {
			// Conditional grants only widen the filter when their subject-level conditions hold.
			if (!this.policyEngine.matchesStoredConditions(grant.conditions, request, false)) {
				continue;
			}
			switch (grant.scope) {
				case "GLOBAL":
					unrestricted = true;
					break;
				case "ORGANIZATION":
					if (tenant.context.organizationId !== undefined) {
						alternatives.push({ organizationId: tenant.context.organizationId });
					}
					break;
				case "STORE": {
					const store =
						grant.store ??
						(tenant.context.organizationId !== undefined && tenant.context.storeId !== undefined
							? { organizationId: tenant.context.organizationId, storeId: tenant.context.storeId }
							: undefined);
					// A store-bound grant only widens the filter for its own store (and only the active store, when one is selected).
					if (store !== undefined && (tenant.context.storeId === undefined || tenant.context.storeId === store.storeId)) {
						alternatives.push({ organizationId: store.organizationId, storeId: store.storeId });
					}
					break;
				}
				case "LOCATION":
					if (tenant.context.organizationId !== undefined && tenant.context.locationId !== undefined) {
						alternatives.push({ organizationId: tenant.context.organizationId, locationId: tenant.context.locationId });
					}
					break;
				case "OWN":
					alternatives.push(resource === "USER" || resource === "PROFILE" ? { id: { in: [context.userId] } } : { userId: context.userId });
					break;
				case "RESOURCE":
					break;
			}
		}

		const allowedIds = acl.allows.flatMap((entry) => (entry.resourceId === null ? [] : [entry.resourceId]));
		if (allowedIds.length > 0) {
			alternatives.push({ id: { in: allowedIds } });
		}

		const base = this.combineAlternatives(unrestricted, alternatives);
		if (base === null) {
			return denyAllRows();
		}

		const deniedIds = acl.denies.flatMap((entry) => (entry.resourceId === null ? [] : [entry.resourceId]));
		if (deniedIds.length === 0) {
			return base;
		}
		return { AND: [base, { NOT: { id: { in: deniedIds } } }] };
	}

	/**
	 * Server-evaluated per-resource capabilities for UI payloads
	 * (`order.authorization.can.delete`, spec §12 option C).
	 */
	public async resourceCapabilities(
		subject: AuthorizationContext,
		resource: PermissionResource,
		resourceId: string | undefined,
		resourceAttributes: AuthorizationAttributes | undefined,
		actions: readonly PermissionAction[] = ALL_ACTIONS,
	): Promise<ResourceAuthorization> {
		const decisions = await Promise.all(
			actions.map(async (action): Promise<[PermissionAction, boolean]> => {
				const decision = await this.can({ subject, action, resource, resourceId, resourceAttributes });
				return [action, decision === "ALLOW"];
			}),
		);
		let can: ResourceCapabilityMap = {};
		for (const [action, allowed] of decisions) {
			can = withResourceCapability(can, action, allowed);
		}
		return { can };
	}

	/** Role-name requirement check (for `@RequireAnyRole` / `@RequireAllRoles`). */
	public async hasRoles(userId: string, roleNames: readonly string[], mode: "all" | "any"): Promise<boolean> {
		if (roleNames.length === 0) {
			return false;
		}
		const subjectGrants = await this.grantsLoader.load(userId);
		const held = new Set(subjectGrants.roleNames);
		return mode === "all" ? roleNames.every((name) => held.has(name)) : roleNames.some((name) => held.has(name));
	}

	private combineAlternatives(unrestricted: boolean, alternatives: readonly RowScopeAlternative[]): BaseRowFilter | null {
		if (unrestricted) {
			return {};
		}
		const only = alternatives.length === 1 ? alternatives.at(0) : undefined;
		if (only !== undefined) {
			return only;
		}
		return alternatives.length === 0 ? null : { OR: [...alternatives] };
	}

	private async evaluateScope(grant: SubjectGrant, request: AuthorizationRequest, resolveOwnership: () => Promise<OwnershipLookup>): Promise<ScopeOutcome> {
		const organizationId = request.subject.organizationId;
		const storeId = request.subject.storeId;
		const locationId = request.subject.locationId;
		const resourceOrganizationId = readStringAttribute(request.resourceAttributes, "organizationId");
		const resourceStoreId = readStringAttribute(request.resourceAttributes, "storeId");
		const resourceLocationId = readStringAttribute(request.resourceAttributes, "locationId");
		const targetsResource = request.resourceId !== undefined;

		switch (grant.scope) {
			case "GLOBAL":
				return { satisfied: true, reason: "GLOBAL grant" };
			case "ORGANIZATION": {
				if (organizationId === undefined) {
					return { satisfied: false, reason: "ORGANIZATION grant requires a verified organization context" };
				}
				if (targetsResource && resourceOrganizationId === undefined) {
					return { satisfied: false, reason: "ORGANIZATION grant requires the resource's organization" };
				}
				if (resourceOrganizationId !== undefined && resourceOrganizationId !== organizationId) {
					return { satisfied: false, reason: "Resource belongs to another organization" };
				}
				return { satisfied: true, reason: "ORGANIZATION grant within verified organization" };
			}
			case "STORE": {
				if (organizationId === undefined || storeId === undefined) {
					return { satisfied: false, reason: "STORE grant requires a verified store context" };
				}
				if (grant.store !== undefined && grant.store.storeId !== storeId) {
					return { satisfied: false, reason: "Store membership role applies to another store" };
				}
				if (targetsResource && resourceStoreId === undefined) {
					return { satisfied: false, reason: "STORE grant requires the resource's store" };
				}
				if ((resourceStoreId !== undefined && resourceStoreId !== storeId) || (resourceOrganizationId !== undefined && resourceOrganizationId !== organizationId)) {
					return { satisfied: false, reason: "Resource belongs to another store" };
				}
				return { satisfied: true, reason: "STORE grant within verified store" };
			}
			case "LOCATION": {
				if (organizationId === undefined || locationId === undefined) {
					return { satisfied: false, reason: "LOCATION grant requires a verified location context" };
				}
				if (targetsResource && resourceLocationId === undefined) {
					return { satisfied: false, reason: "LOCATION grant requires the resource's location" };
				}
				if ((resourceLocationId !== undefined && resourceLocationId !== locationId) || (resourceOrganizationId !== undefined && resourceOrganizationId !== organizationId)) {
					return { satisfied: false, reason: "Resource belongs to another location" };
				}
				return { satisfied: true, reason: "LOCATION grant within verified location" };
			}
			case "OWN": {
				if (!targetsResource) {
					return { satisfied: false, reason: "OWN grant requires a specific resource" };
				}
				const lookup = await resolveOwnership();
				if (lookup.kind === "unsupported") {
					return { satisfied: false, reason: "Resource type has no ownership model" };
				}
				if (lookup.kind === "missing" || lookup.ownerUserId !== request.subject.userId) {
					return { satisfied: false, reason: "Subject does not own the resource" };
				}
				return { satisfied: true, reason: "Subject owns the resource" };
			}
			case "RESOURCE":
				return { satisfied: false, reason: "RESOURCE-scoped grants apply only through explicit ACL entries" };
		}
	}
}
