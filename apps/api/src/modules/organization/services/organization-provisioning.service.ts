import { Injectable } from "@nestjs/common";
import type { AdminCreateOrganizationInviteInput, MerchantBusinessCategory, PilotCity } from "@workspace/shared";
import { createHash, randomBytes } from "node:crypto";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { allocateUniqueOrganizationSlug } from "../utils/organization-slug.util";

export interface ProvisionedOrganization {
	readonly organizationId: string;
	readonly locationId: string;
	readonly inviteToken: string;
}

export interface MerchantOnboardingProvisionInput {
	readonly userId: string;
	readonly businessName: string;
	readonly category: MerchantBusinessCategory;
	readonly city: PilotCity;
	readonly contactEmail: string;
}

export interface MerchantOnboardingProvisionResult {
	readonly organizationId: string;
	readonly locationId: string;
	readonly slug: string;
}

@Injectable()
export class OrganizationProvisioningService {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	/** Idempotent saga step: create organization + primary location + invite. */
	public async provisionFromPlatformInvite(adminUserId: string, input: AdminCreateOrganizationInviteInput): Promise<ProvisionedOrganization> {
		const rawToken = randomBytes(32).toString("hex");
		const tokenHash = createHash("sha256").update(rawToken).digest("hex");

		const result = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Platform-invited organization provisioning",
				correlationId: `provision:${input.slug}`,
				actorUserId: adminUserId,
			},
			async (tx) => {
				const org = await tx.organization.create({
					data: {
						slug: input.slug,
						displayName: input.displayName,
						lifecycleState: "PROVISIONING",
						locations: {
							create: {
								name: `${input.displayName} — Primary`,
								code: "primary",
								isPrimary: true,
							},
						},
						merchantProfile: {
							create: {
								category: input.category,
								city: input.city as PilotCity,
								contactEmail: input.email,
								kybStatus: "PENDING",
							},
						},
						placement: { create: { kind: "SHARED", regionCode: "default" } },
						entitlements: {
							create: {
								planCode: "pilot",
								features: { rewards: true, apiKeys: true },
								version: 1,
								effectiveFrom: BigInt(Date.now()),
							},
						},
						lifecycleEvents: {
							create: {
								fromState: null,
								toState: "PROVISIONING",
								actorUserId: adminUserId,
								reason: "Platform invite created",
							},
						},
					},
					include: { locations: true },
				});

				await tx.organizationInvitation.create({
					data: {
						organizationId: org.id,
						email: input.email,
						tokenHash,
						intendedRole: input.intendedRole,
						createdByAdminId: adminUserId,
						expiresAt: BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
				});

				const primaryLocation = org.locations[0];
				return { organizationId: org.id, locationId: primaryLocation.id };
			},
		);

		return { ...result, inviteToken: rawToken };
	}

	/** Create canonical Organization + primary location + OWNER membership for merchant onboarding. */
	public async provisionFromMerchantOnboarding(input: MerchantOnboardingProvisionInput): Promise<MerchantOnboardingProvisionResult> {
		return this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Merchant onboarding organization provisioning",
				correlationId: `merchant-onboard:${input.contactEmail}`,
				actorUserId: input.userId,
			},
			async (tx) => {
				const slug = await allocateUniqueOrganizationSlug(tx, input.businessName);
				const now = BigInt(Date.now());

				const org = await tx.organization.create({
					data: {
						slug,
						displayName: input.businessName,
						lifecycleState: "ACTIVE",
						locations: {
							create: {
								name: `${input.businessName} — Primary`,
								code: "primary",
								isPrimary: true,
							},
						},
						merchantProfile: {
							create: {
								legalName: input.businessName,
								category: input.category,
								city: input.city,
								contactEmail: input.contactEmail,
								kybStatus: "PENDING",
							},
						},
						placement: { create: { kind: "SHARED", regionCode: "default" } },
						entitlements: {
							create: {
								planCode: "pilot",
								features: { rewards: true, apiKeys: true },
								version: 1,
								effectiveFrom: now,
							},
						},
						lifecycleEvents: {
							create: [
								{
									fromState: null,
									toState: "PROVISIONING",
									actorUserId: input.userId,
									reason: "Merchant onboarding started",
								},
								{
									fromState: "PROVISIONING",
									toState: "ACTIVE",
									actorUserId: input.userId,
									reason: "Merchant onboarding completed",
								},
							],
						},
					},
					include: { locations: true },
				});

				const primaryLocation = org.locations[0];
				const membership = await tx.organizationMembership.create({
					data: {
						organizationId: org.id,
						userId: input.userId,
						role: "OWNER",
						status: "ACTIVE",
					},
				});

				await tx.organizationMembershipLocationScope.create({
					data: {
						organizationId: org.id,
						membershipId: membership.id,
						scopeType: "ALL_LOCATIONS",
					},
				});

				return { organizationId: org.id, locationId: primaryLocation.id, slug: org.slug };
			},
		);
	}

	public async activateOrganization(organizationId: string, actorUserId: string): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Activate organization after onboarding",
				correlationId: `activate:${organizationId}`,
				actorUserId,
			},
			async (tx) => {
				const org = await tx.organization.update({
					where: { id: organizationId },
					data: { lifecycleState: "ACTIVE" },
				});
				await tx.organizationLifecycleEvent.create({
					data: {
						organizationId: org.id,
						fromState: "PROVISIONING",
						toState: "ACTIVE",
						actorUserId,
						reason: "Onboarding complete",
					},
				});
			},
		);
	}
}
