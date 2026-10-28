import { Injectable } from "@nestjs/common";
import type {
	AuthorizationAttributes,
	AuthorizationContext,
	AuthorizationDecision,
	AuthorizationEvaluationStep,
	AuthorizationRequest,
	AuthorizationResult,
} from "@workspace/shared";
import { isStringPrimitive, PermissionPairSchema } from "@workspace/shared";

import type { AuthorizationKernelPort } from "../../application/ports/authorization-kernel.port";
import { AccessControlService } from "../../application/services/access-control.service";
import type { AccessTarget } from "../../domain/access/access-request";
import { AccessDeniedError } from "../../domain/errors/authorization.errors";
import { AuthorizationAuditKernelService, type AuthorizationAuditMetadata } from "./authorization-audit-kernel.service";
import { TenantMembershipService, type RequestedTenant, type TenantVerification } from "./tenant-membership.service";

function requestedTenant(subject: AuthorizationContext): RequestedTenant {
	return {
		...(subject.tenantId === undefined ? {} : { tenantId: subject.tenantId }),
		...(subject.locationId === undefined ? {} : { locationId: subject.locationId }),
	};
}

function tenantRejectionReason(tenant: TenantVerification): string | null {
	if (tenant.tenantRejected) {
		return "Subject is not an active member of the requested tenant";
	}
	if (tenant.locationRejected) {
		return "Requested location is outside the subject's membership scope";
	}
	return null;
}

function readStringAttribute(attributes: AuthorizationAttributes | undefined, key: string): string | undefined {
	const value = attributes?.[key];
	return isStringPrimitive(value) ? value : undefined;
}

/**
 * The record the request is about: its id, and the store it sits in — read from server-side attributes,
 * or else the store the request was verified for (acting "at store X" is decided for store X).
 */
function targetOf(request: AuthorizationRequest, resource: AccessTarget["resource"], verifiedLocationId: string | undefined): AccessTarget | undefined {
	const locationId = readStringAttribute(request.resourceAttributes, "locationId") ?? verifiedLocationId;
	if (request.resourceId === undefined && locationId === undefined) {
		return undefined;
	}
	return {
		resource,
		...(request.resourceId === undefined ? {} : { resourceId: request.resourceId }),
		...(locationId === undefined ? {} : { locationId }),
	};
}

/**
 * The authorization kernel port, kept as a FACADE (ADR 067): it verifies the tenant a request claims
 * (ReBAC: user → active member → tenant → store), hands the decision to `AccessControlService` — the
 * one decision service, deny by default, allowed by role, grant, share or ownership — and records it
 * as an `AuthorizationResult` naming the path that allowed it. SuperAdmin keeps its audited platform
 * bypass. PostgreSQL RLS remains the row boundary beneath every decision.
 */
@Injectable()
export class AuthorizationKernelService implements AuthorizationKernelPort {
	public constructor(
		private readonly tenantMembership: TenantMembershipService,
		private readonly accessControl: AccessControlService,
		private readonly audit: AuthorizationAuditKernelService,
	) {}

	/** Boolean decision, no side effects. */
	public async can(request: AuthorizationRequest): Promise<AuthorizationDecision> {
		return (await this.explain(request)).decision;
	}

	/**
	 * Security-boundary check: audits the decision (DENY / writes / sensitive reads) and throws the
	 * uniform 403 when denied. The exception never reveals which rule failed — use `explain()`.
	 */
	public async authorize(request: AuthorizationRequest, metadata?: AuthorizationAuditMetadata): Promise<void> {
		const result = await this.explain(request);
		await this.audit.auditResult(result, metadata);
		if (result.decision === "DENY") {
			throw new AccessDeniedError();
		}
	}

	/** The decision with its steps: tenant verification, then the allow path (or the default deny). */
	public async explain(request: AuthorizationRequest): Promise<AuthorizationResult> {
		const startedAt = Date.now();
		const evaluation: AuthorizationEvaluationStep[] = [];
		const finish = (decision: AuthorizationDecision, evaluated: AuthorizationRequest): AuthorizationResult => ({
			decision,
			request: evaluated,
			evaluation,
			durationMs: Date.now() - startedAt,
		});

		if (request.subject.isSuperAdmin === true && request.subject.tenantId === undefined) {
			evaluation.push({ source: "superadmin", effect: "ALLOW", reason: "Platform SuperAdmin bypass" });
			return finish("ALLOW", request);
		}

		const permission = PermissionPairSchema.safeParse({ action: request.action, resource: request.resource });
		if (!permission.success) {
			evaluation.push({ source: "validation", effect: "DENY", reason: "Unknown action or resource" });
			return finish("DENY", request);
		}

		const tenant = await this.tenantMembership.verify(request.subject.userId, requestedTenant(request.subject));
		const rejection = tenantRejectionReason(tenant);
		if (rejection !== null) {
			evaluation.push({ source: "tenant", effect: "DENY", reason: rejection });
			return finish("DENY", request);
		}
		const tenantId = tenant.context.tenantId;
		const evaluated: AuthorizationRequest = { ...request, subject: { ...request.subject, tenantId, locationId: tenant.context.locationId } };
		if (tenantId !== undefined) {
			evaluation.push({
				source: "relationship",
				effect: "NO_MATCH",
				reason: tenant.supportAccessGrantId === undefined ? "Verified active tenant membership" : "Verified an approved support grant",
				details: { tenantId },
			});
		}

		const target = targetOf(request, permission.data.resource, tenant.context.locationId);
		const decision = await this.accessControl.decide({
			userId: request.subject.userId,
			...(tenantId === undefined ? {} : { tenantId }),
			permission: permission.data,
			...(target === undefined ? {} : { target }),
		});
		if (decision.path === null) {
			evaluation.push({ source: "default", effect: "DENY", reason: "No role, grant, share or ownership allows this (deny by default)" });
			return finish("DENY", evaluated);
		}
		evaluation.push({ source: decision.path, effect: "ALLOW", reason: `Allowed by ${decision.path}` });
		return finish("ALLOW", evaluated);
	}
}
