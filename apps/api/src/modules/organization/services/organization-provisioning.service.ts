import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { AdminCreateOrganizationInviteInput, PilotCity } from "@workspace/shared";

import { ConflictError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { ORGANIZATION_DEFAULT_PLAN } from "../constants/organization-plan";
import { allocateUniqueOrganizationSlug } from "../utils/organization-slug.util";
import { findActivePolicyVersionInTx, seedRewardHubTenantPolicies } from "../utils/rewardhub-policy-seed.util";
import { withUniqueViolationAs } from "../utils/unique-violation.util";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationLifecycleEventRecorder } from "./organization-lifecycle-event.recorder";

/** Days an organization onboarding invitation stays valid. */
const ONBOARDING_INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ONBOARDING_INVITE_TTL_MS = ONBOARDING_INVITE_TTL_DAYS * MS_PER_DAY;
/** Random bytes in an onboarding invite token (hex in the link; only its SHA-256 is stored). */
const INVITE_TOKEN_BYTES = 32;
/** Shared tenant placement every organization starts in (dedicated placement is an operator migration). */
const DEFAULT_PLACEMENT = { kind: "SHARED", regionCode: "default" } satisfies { readonly kind: "SHARED"; readonly regionCode: string };

/** Error codes for provisioning conflicts. */
export const ORGANIZATION_PROVISIONING_ERROR_CODES = {
	slugTaken: "ORGANIZATION_SLUG_TAKEN",
	notProvisioning: "ORGANIZATION_NOT_PROVISIONING",
} satisfies Readonly<Record<string, string>>;

/** The transaction client a system operation hands its handler (the caller's onboarding transaction). */
type ProvisioningTransaction = Parameters<Parameters<TenantTransactionService["withSystemOperation"]>[1]>[0];

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export interface ProvisionedOrganization {
	readonly organizationId: string;
	readonly inviteToken: string;
}

export interface RewardHubAdminInviteProvisionResult {
	readonly organizationId: string;
	readonly inviteId: string;
	readonly inviteToken: string;
	readonly expiresAt: number;
}

/**
 * Provisioning creates an organization in PROVISIONING with its merchant
 * profile, placement, entitlements, default tenant policies and an onboarding
 * invitation — and NO location: the primary store is created when the merchant
 * submits its address during onboarding (`finalizeOnboardingLocations`).
 *
 * Provisioning is not idempotent by request: each call mints a new invite token
 * that only exists in the response. A duplicate platform invite for the same
 * slug fails with 409 (the slug is unique); clients that need safe retries send
 * an `Idempotency-Key` (the HTTP idempotency layer replays the first response).
 */
@Injectable()
export class OrganizationProvisioningService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
		private readonly lifecycleEvents: OrganizationLifecycleEventRecorder,
	) {}

	public async provisionFromPlatformInvite(adminUserId: string, input: AdminCreateOrganizationInviteInput): Promise<ProvisionedOrganization> {
		const rawToken = randomBytes(INVITE_TOKEN_BYTES).toString("hex");
		const tokenHash = sha256Hex(rawToken);
		const now = Date.now();

		const organizationId = await withUniqueViolationAs(
			async () =>
				this.tenantTx.withSystemOperation(
					{
						operation: "organization.provision.platform_invite",
						reason: "Platform-invited organization provisioning",
						actorUserId: adminUserId,
					},
					async (tx) => {
						const org = await tx.organization.create({
							data: {
								slug: input.slug,
								displayName: input.displayName,
								lifecycleState: "PROVISIONING",
								merchantProfile: {
									create: {
										category: input.category,
										city: input.city,
										contactEmail: input.email,
										kybStatus: "PENDING",
									},
								},
								placement: { create: { ...DEFAULT_PLACEMENT } },
								entitlements: {
									create: {
										planCode: ORGANIZATION_DEFAULT_PLAN.planCode,
										features: { ...ORGANIZATION_DEFAULT_PLAN.features },
										version: ORGANIZATION_DEFAULT_PLAN.version,
										effectiveFrom: BigInt(now),
									},
								},
							},
						});
						await this.lifecycleEvents.recordInTx(tx, {
							organizationId: org.id,
							fromState: null,
							toState: "PROVISIONING",
							actorUserId: adminUserId,
							reason: "Platform invite created",
						});

						const invite = await tx.organizationInvitation.create({
							data: {
								organizationId: org.id,
								email: input.email,
								tokenHash,
								kind: "PLATFORM_ONBOARDING",
								intendedRole: input.intendedRole,
								createdByAdminId: adminUserId,
								expiresAt: BigInt(now + ONBOARDING_INVITE_TTL_MS),
							},
						});

						await seedRewardHubTenantPolicies(tx, org.id, adminUserId);
						await this.audit.recordInTx(tx, {
							organizationId: org.id,
							actorUserId: adminUserId,
							policyVersion: await findActivePolicyVersionInTx(tx, org.id),
							action: "organization.provisioned",
							resourceType: "Organization",
							resourceId: org.id,
							metadata: { source: "platform_invite", inviteId: invite.id, intendedRole: input.intendedRole },
						});
						return org.id;
					},
				),
			(cause) => new ConflictError({ code: ORGANIZATION_PROVISIONING_ERROR_CODES.slugTaken, message: "An organization with this slug already exists", cause }),
		);

		return { organizationId, inviteToken: rawToken };
	}

	/**
	 * Pre-provision organization + onboarding invitation for the RewardHub admin
	 * merchant invite. The business category is left NULL — the merchant states
	 * it during onboarding; no placeholder category is invented here.
	 */
	public async provisionFromRewardHubAdminInvite(
		adminUserId: string,
		input: { readonly email: string; readonly businessName: string; readonly city: PilotCity },
	): Promise<RewardHubAdminInviteProvisionResult> {
		const rawToken = randomBytes(INVITE_TOKEN_BYTES).toString("hex");
		const tokenHash = sha256Hex(rawToken);
		const now = Date.now();
		const expiresAt = now + ONBOARDING_INVITE_TTL_MS;

		const result = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision.admin_merchant_invite",
				reason: "RewardHub admin merchant invite",
				actorUserId: adminUserId,
			},
			async (tx) => {
				const slug = await allocateUniqueOrganizationSlug(tx, input.businessName);

				const org = await tx.organization.create({
					data: {
						slug,
						displayName: input.businessName,
						lifecycleState: "PROVISIONING",
						merchantProfile: {
							create: {
								category: null,
								city: input.city,
								contactEmail: input.email,
								kybStatus: "PENDING",
							},
						},
						placement: { create: { ...DEFAULT_PLACEMENT } },
						entitlements: {
							create: {
								planCode: ORGANIZATION_DEFAULT_PLAN.planCode,
								features: { ...ORGANIZATION_DEFAULT_PLAN.features },
								version: ORGANIZATION_DEFAULT_PLAN.version,
								effectiveFrom: BigInt(now),
							},
						},
					},
				});
				await this.lifecycleEvents.recordInTx(tx, {
					organizationId: org.id,
					fromState: null,
					toState: "PROVISIONING",
					actorUserId: adminUserId,
					reason: "RewardHub admin invite created",
				});

				const invite = await tx.organizationInvitation.create({
					data: {
						organizationId: org.id,
						email: input.email,
						tokenHash,
						kind: "PLATFORM_ONBOARDING",
						intendedRole: "OWNER",
						status: "PENDING",
						createdByAdminId: adminUserId,
						expiresAt: BigInt(expiresAt),
					},
				});

				await seedRewardHubTenantPolicies(tx, org.id, adminUserId);
				await this.audit.recordInTx(tx, {
					organizationId: org.id,
					actorUserId: adminUserId,
					policyVersion: await findActivePolicyVersionInTx(tx, org.id),
					action: "organization.provisioned",
					resourceType: "Organization",
					resourceId: org.id,
					metadata: { source: "rewardhub_admin_invite", inviteId: invite.id },
				});

				return { organizationId: org.id, inviteId: invite.id };
			},
		);

		return { ...result, inviteToken: rawToken, expiresAt };
	}

	/**
	 * Ensure the onboarding user holds a live OWNER membership (ALL_LOCATIONS),
	 * inside the caller's onboarding transaction. A concurrent creator loses on
	 * the one-live-membership partial unique index, which rolls the caller's
	 * whole transaction back (the invite claim included) — never a duplicate.
	 */
	public async ensureOwnerMembershipInTx(tx: ProvisioningTransaction, organizationId: string, userId: string): Promise<void> {
		const existing = await tx.organizationMembership.findFirst({
			where: { organizationId, userId, isDeleted: false },
			select: { id: true },
		});
		if (existing !== null) {
			return;
		}
		const membership = await tx.organizationMembership.create({
			data: {
				organizationId,
				userId,
				role: "OWNER",
				status: "ACTIVE",
				locationScopes: { create: [{ organizationId, scopeType: "ALL_LOCATIONS" }] },
			},
		});
		await this.audit.recordInTx(tx, {
			organizationId,
			actorUserId: userId,
			policyVersion: await findActivePolicyVersionInTx(tx, organizationId),
			action: "membership.owner_created",
			resourceType: "OrganizationMembership",
			resourceId: membership.id,
		});
	}

	/**
	 * PROVISIONING → ACTIVE as a compare-and-set, inside the caller's onboarding
	 * transaction. An organization that is no longer PROVISIONING is a 409.
	 */
	public async activateAfterOnboardingInTx(tx: ProvisioningTransaction, organizationId: string, actorUserId: string): Promise<void> {
		const now = BigInt(Date.now());
		const activated = await tx.organization.updateMany({
			where: { id: organizationId, lifecycleState: "PROVISIONING", isDeleted: false },
			data: { lifecycleState: "ACTIVE", updatedAt: now },
		});
		if (activated.count !== 1) {
			throw new ConflictError({ code: ORGANIZATION_PROVISIONING_ERROR_CODES.notProvisioning, message: "Only an organization in provisioning can be activated" });
		}
		await this.lifecycleEvents.recordInTx(tx, { organizationId, fromState: "PROVISIONING", toState: "ACTIVE", actorUserId, reason: "Onboarding complete" });
		await this.audit.recordInTx(tx, {
			organizationId,
			actorUserId,
			policyVersion: await findActivePolicyVersionInTx(tx, organizationId),
			action: "organization.activated",
			resourceType: "Organization",
			resourceId: organizationId,
		});
	}
}
