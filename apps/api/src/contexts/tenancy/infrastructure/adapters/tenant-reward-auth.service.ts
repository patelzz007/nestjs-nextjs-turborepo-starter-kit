import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CapabilitySlug, MembershipRole, MerchantCapability, TenantRewardMembershipResponse } from "@workspace/shared";
import { MERCHANT_CAPABILITY_PERMISSION, merchantCapabilitiesOf, MerchantCapabilitySchema } from "@workspace/shared";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { ACCESS_CONTROL, type AccessControlPort } from "../../../authorization/public-api";
import { TenantAuditService } from "../audit/tenant-audit.adapter";
import { TenantContextService } from "./tenant-context.service";

export interface ResolvedTenantRewardContext {
	readonly tenantId: string;
	readonly slug: string;
	readonly userId: string;
	readonly membership: TenantRewardMembershipResponse;
}

/** The member a merchant capability is checked for — always resolved server-side, never from the request. */
export interface TenantCapabilitySubject {
	readonly userId: string;
	readonly tenantId: string;
	readonly role: MembershipRole;
}

/** The merchant capability slug, or a 403 for a slug no permission backs (fail closed). */
function knownCapability(capability: CapabilitySlug): MerchantCapability {
	const parsed = MerchantCapabilitySchema.safeParse(capability);
	if (!parsed.success) {
		throw new ForbiddenException({ message: "Unknown merchant capability", error: "TENANT_CAPABILITY_UNKNOWN", capability });
	}
	return parsed.data;
}

@Injectable()
export class TenantRewardAuthService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly tenantContext: TenantContextService,
		@Inject(ACCESS_CONTROL) private readonly accessControl: AccessControlPort,
		private readonly audit: TenantAuditService,
	) {}

	public async resolveTenantFromSlug(userId: string, tenantSlug: string): Promise<ResolvedTenantRewardContext> {
		const resolved = await this.tenantContext.resolveBySlug(userId, tenantSlug);
		const org = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.context.resolve_membership",
				reason: "Resolve the caller's tenant membership context",
				actorUserId: userId,
			},
			async (tx) =>
				tx.tenant.findUnique({
					where: { id: resolved.tenantId },
					include: { merchantProfile: true },
				}),
		);

		if (org === null) {
			throw new NotFoundException({ message: "Tenant not found", error: "TENANT_NOT_FOUND" });
		}

		const membership: TenantRewardMembershipResponse = {
			tenantId: resolved.tenantId,
			tenantSlug: resolved.slug,
			displayName: org.displayName,
			role: resolved.membership.role,
			capabilities: [...(await this.capabilitiesOf(userId, resolved.tenantId))],
			kybStatus: org.merchantProfile?.kybStatus ?? "PENDING",
			lifecycleState: org.lifecycleState,
		};

		return {
			tenantId: resolved.tenantId,
			slug: resolved.slug,
			userId,
			membership,
		};
	}

	/** The merchant capabilities the member holds right now (role + live grants) — what the merchant app shows. */
	public async capabilitiesOf(userId: string, tenantId: string): Promise<readonly MerchantCapability[]> {
		return merchantCapabilitiesOf(await this.accessControl.effectivePermissions(userId, tenantId));
	}

	/**
	 * The single merchant capability check (ADR 067): the capability's `noun.verb` permission, decided by
	 * the access-control service (the member's role, a live grant — deny by default) and audited with the
	 * path that allowed it. Throws 403.
	 */
	public async requireMembershipCapability(subject: TenantCapabilitySubject, capability: CapabilitySlug): Promise<void> {
		const permission = MERCHANT_CAPABILITY_PERMISSION[knownCapability(capability)];
		const decision = await this.accessControl.decide({ userId: subject.userId, tenantId: subject.tenantId, permission });
		await this.tenantTx.withTenantTransaction({ userId: subject.userId, tenantId: subject.tenantId, purpose: `authorize.${capability}` }, (tx) =>
			this.audit.recordInTx(tx, {
				tenantId: subject.tenantId,
				actorUserId: subject.userId,
				action: `authorize.${capability}`,
				resourceType: "Tenant",
				resourceId: subject.tenantId,
				decision: decision.allowed ? "Allow" : "Deny",
				...(decision.path === null ? {} : { metadata: { allowedBy: decision.path } }),
			}),
		);
		if (!decision.allowed) {
			throw new ForbiddenException({ message: "Your tenant role does not include this capability", error: "TENANT_ROLE_CAPABILITY_REQUIRED", capability });
		}
	}

	/** Resolves the caller's membership for `tenantSlug` (uniform 404 for non-members), then {@link requireMembershipCapability}. */
	public async requireCapabilityForSlug(userId: string, tenantSlug: string, capability: CapabilitySlug): Promise<ResolvedTenantRewardContext> {
		const resolved = await this.resolveTenantFromSlug(userId, tenantSlug);
		await this.requireMembershipCapability({ userId, tenantId: resolved.tenantId, role: resolved.membership.role }, capability);
		return resolved;
	}
}
