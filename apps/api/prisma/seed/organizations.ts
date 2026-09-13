import { createHash } from "node:crypto";

import type { Organization, User } from "@prisma/client";

import { seedRewardHubTenantPolicies } from "../../src/modules/organization/utils/rewardhub-policy-seed.util";

import { prisma } from "./client";

/** Fixed seed UUIDs for canonical organizations (URL slugs are the merchant entry point). */
export const ORGANIZATION_SEED_IDS = {
	klOrganization: "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
	mlkOrganization: "b57401d5-536e-464f-9ae9-4756b6dd5f61",
	klLocation: "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
	mlkLocationKatil: "d57401d5-536e-464f-9ae9-4756b6dd5f62",
	mlkLocationBeruang: "257401d5-536e-464f-9ae9-4756b6dd5f65",
	klOwnerMembership: "e178a4d1-6915-4eb3-bf84-6fb14e1feb6e",
	mlkOwnerMembership: "f57401d5-536e-464f-9ae9-4756b6dd5f63",
	klCashierMembership: "0178a4d1-6915-4eb3-bf84-6fb14e1feb6f",
	mlkCashierMembership: "157401d5-536e-464f-9ae9-4756b6dd5f64",
	pendingNyonyaInvitation: "2178a4d1-6915-4eb3-bf84-6fb14e1feb70",
} as const;

export const ORGANIZATION_SEED_SLUGS = {
	kl: "brew-bean-kl",
	mlk: "jonker-street-kitchen",
} as const;

const PLATFORM_GUARDRAIL_CEDAR = `forbid(principal, action, resource) when { action == "assignPolicyAdmin" && principal.role != "OWNER" };
forbid(principal, action, resource) when { action == "removeLastOwner" };`;

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function msFromNow(days: number): number {
	return Date.now() + days * 24 * 60 * 60 * 1000;
}

export async function cleanupOrganizationSeedData(): Promise<void> {
	await prisma.organizationAuditLog.deleteMany();
	await prisma.supportAccessGrant.deleteMany();
	await prisma.tenantEncryptionKey.deleteMany();
	await prisma.authorizationPolicySimulation.deleteMany();
	await prisma.authorizationPolicyVersion.deleteMany();
	await prisma.authorizationPolicyDraft.deleteMany();
	await prisma.organizationQuota.deleteMany();
	await prisma.organizationEntitlement.deleteMany();
	await prisma.organizationLifecycleEvent.deleteMany();
	await prisma.organizationAccessRequest.deleteMany();
	await prisma.organizationInvitation.deleteMany();
	await prisma.organizationMembershipLocationScope.deleteMany();
	await prisma.organizationMembership.deleteMany();
	await prisma.organizationMerchantProfile.deleteMany();
	await prisma.organizationSlugHistory.deleteMany();
	await prisma.tenantPlacement.deleteMany();
	await prisma.organizationLocation.deleteMany();
	await prisma.organization.deleteMany();
}

export async function seedPlatformGuardrails(superAdmin: User): Promise<void> {
	const existing = await prisma.authorizationPolicyVersion.findFirst({
		where: { organizationId: null, scope: "PLATFORM_GUARDRAIL", supersededAt: null },
	});

	if (existing !== null) {
		return;
	}

	const draft = await prisma.authorizationPolicyDraft.create({
		data: {
			organizationId: null,
			scope: "PLATFORM_GUARDRAIL",
			name: "Platform guardrails",
			description: "Non-bypassable owner and policy-admin protections",
			builderPayload: { templateId: "platform.guardrail.no_escalation", parameters: {} },
			cedarSource: PLATFORM_GUARDRAIL_CEDAR,
			status: "PUBLISHED",
			createdById: superAdmin.id,
			approvedById: superAdmin.id,
		},
	});

	const contentHash = sha256Hex(PLATFORM_GUARDRAIL_CEDAR);
	await prisma.authorizationPolicyVersion.create({
		data: {
			organizationId: null,
			draftId: draft.id,
			scope: "PLATFORM_GUARDRAIL",
			version: 1,
			cedarSource: PLATFORM_GUARDRAIL_CEDAR,
			contentHash,
			publishedAt: BigInt(Date.now()),
			publishedById: superAdmin.id,
		},
	});
}

export interface SeededOrganizations {
	readonly klOrganization: Organization;
	readonly mlkOrganization: Organization;
}

export async function seedOrganizationsAndMerchants(
	adminUser: User,
	klOwner: User,
	mlkOwner: User,
	klCashier: User,
	mlkCashier: User,
	accessRequestUser: User,
): Promise<SeededOrganizations> {
	const now = BigInt(Date.now());

	const klOrganization = await prisma.organization.create({
		data: {
			id: ORGANIZATION_SEED_IDS.klOrganization,
			slug: ORGANIZATION_SEED_SLUGS.kl,
			displayName: "Brew & Bean KL",
			lifecycleState: "ACTIVE",
			locations: {
				create: {
					id: ORGANIZATION_SEED_IDS.klLocation,
					name: "Brew & Bean KL — Bukit Bintang",
					code: "primary",
					isPrimary: true,
				},
			},
			merchantProfile: {
				create: {
					legalName: "Brew & Bean KL Sdn Bhd",
					category: "cafe",
					addressText: "12 Jalan Bukit Bintang, Kuala Lumpur",
					city: "KUALA_LUMPUR",
					kybStatus: "APPROVED",
					kybFields: {
						registrationNo: "201901012345",
						taxId: "C12345678",
					},
					contactEmail: klOwner.email,
					contactPhone: "+60321456789",
				},
			},
			placement: {
				create: {
					kind: "SHARED",
					regionCode: "default",
				},
			},
			entitlements: {
				create: {
					planCode: "pilot",
					features: { rewards: true, apiKeys: true, analytics: true },
					version: 1,
					effectiveFrom: now,
				},
			},
			lifecycleEvents: {
				create: {
					fromState: "PROVISIONING",
					toState: "ACTIVE",
					actorUserId: adminUser.id,
					reason: "Seed: organization provisioned",
				},
			},
		},
	});

	const mlkOrganization = await prisma.organization.create({
		data: {
			id: ORGANIZATION_SEED_IDS.mlkOrganization,
			slug: ORGANIZATION_SEED_SLUGS.mlk,
			displayName: "Jonker Street Kitchen",
			lifecycleState: "ACTIVE",
			locations: {
				create: [
					{
						id: ORGANIZATION_SEED_IDS.mlkLocationKatil,
						name: "Jonker Street Kitchen — Bukit Katil",
						code: "bukit-katil",
						addressText: "12 Jalan Bukit Katil, 75450 Melaka",
						city: "MELAKA",
						contactPhone: "+6062812345",
						isPrimary: true,
					},
					{
						id: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
						name: "Jonker Street Kitchen — Bukit Beruang",
						code: "bukit-beruang",
						addressText: "88 Jalan Bukit Beruang, 75450 Melaka",
						city: "MELAKA",
						contactPhone: "+6062815678",
						isPrimary: false,
					},
				],
			},
			merchantProfile: {
				create: {
					legalName: "Jonker Kitchen Melaka",
					category: "restaurant",
					addressText: "12 Jalan Bukit Katil, 75450 Melaka",
					city: "MELAKA",
					kybStatus: "PENDING",
					kybFields: {
						registrationNo: "202002023456",
					},
					contactEmail: mlkOwner.email,
					contactPhone: "+6062821234",
				},
			},
			placement: {
				create: {
					kind: "SHARED",
					regionCode: "default",
				},
			},
			entitlements: {
				create: {
					planCode: "pilot",
					features: { rewards: true, apiKeys: true },
					version: 1,
					effectiveFrom: now,
				},
			},
			lifecycleEvents: {
				create: {
					fromState: "PROVISIONING",
					toState: "ACTIVE",
					actorUserId: adminUser.id,
					reason: "Seed: organization provisioned",
				},
			},
		},
	});

	await prisma.organizationMembership.createMany({
		data: [
			{
				id: ORGANIZATION_SEED_IDS.klOwnerMembership,
				organizationId: klOrganization.id,
				userId: klOwner.id,
				role: "OWNER",
				status: "ACTIVE",
			},
			{
				id: ORGANIZATION_SEED_IDS.klCashierMembership,
				organizationId: klOrganization.id,
				userId: klCashier.id,
				role: "CASHIER",
				status: "ACTIVE",
			},
			{
				id: ORGANIZATION_SEED_IDS.mlkOwnerMembership,
				organizationId: mlkOrganization.id,
				userId: mlkOwner.id,
				role: "OWNER",
				status: "ACTIVE",
			},
			{
				id: ORGANIZATION_SEED_IDS.mlkCashierMembership,
				organizationId: mlkOrganization.id,
				userId: mlkCashier.id,
				role: "CASHIER",
				status: "ACTIVE",
			},
		],
	});

	await prisma.organizationMembershipLocationScope.createMany({
		data: [
			{
				organizationId: klOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.klOwnerMembership,
				scopeType: "ALL_LOCATIONS",
			},
			{
				organizationId: klOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.klCashierMembership,
				scopeType: "SELECTED",
				locationId: ORGANIZATION_SEED_IDS.klLocation,
			},
			{
				organizationId: mlkOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.mlkOwnerMembership,
				scopeType: "ALL_LOCATIONS",
			},
			{
				organizationId: mlkOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.mlkCashierMembership,
				scopeType: "SELECTED",
				locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
			},
		],
	});

	await prisma.organizationInvitation.create({
		data: {
			id: ORGANIZATION_SEED_IDS.pendingNyonyaInvitation,
			organizationId: mlkOrganization.id,
			email: "pending.invite@melaka-rewards.demo",
			tokenHash: sha256Hex("seed_invite_token_mlk_pending"),
			intendedRole: "OWNER",
			status: "PENDING",
			createdByAdminId: adminUser.id,
			expiresAt: BigInt(msFromNow(7)),
		},
	});

	await prisma.organizationAccessRequest.create({
		data: {
			organizationId: mlkOrganization.id,
			userId: accessRequestUser.id,
			status: "PENDING",
			message: "I run a food blog and would like to help promote Jonker Street Kitchen rewards.",
		},
	});

	await prisma.tenantEncryptionKey.createMany({
		data: [
			{
				organizationId: klOrganization.id,
				keyVersion: 1,
				wrappedKey: "seed-wrapped-key-kl-v1",
				kmsKeyId: "local:pilot",
				status: "ACTIVE",
			},
			{
				organizationId: mlkOrganization.id,
				keyVersion: 1,
				wrappedKey: "seed-wrapped-key-mlk-v1",
				kmsKeyId: "local:pilot",
				status: "ACTIVE",
			},
		],
	});

	const windowStart = BigInt(Math.floor(Date.now() / 86_400_000) * 86_400_000);
	const windowEnd = windowStart + BigInt(86_400_000);

	await prisma.organizationQuota.createMany({
		data: [
			{
				organizationId: klOrganization.id,
				quotaKey: "api.requests.daily",
				limitValue: BigInt(10_000),
				usedValue: BigInt(120),
				windowStart,
				windowEnd,
			},
			{
				organizationId: mlkOrganization.id,
				quotaKey: "api.requests.daily",
				limitValue: BigInt(10_000),
				usedValue: BigInt(45),
				windowStart,
				windowEnd,
			},
		],
	});

	await seedRewardHubTenantPolicies(prisma, klOrganization.id, adminUser.id);
	await seedRewardHubTenantPolicies(prisma, mlkOrganization.id, adminUser.id);

	return { klOrganization, mlkOrganization };
}

export function printOrganizationSeedCredentials(): void {
	console.log(`
🏢 Organization workspace (merchant portal)
──────────────────────────────────────────────
Brew & Bean KL — brew.owner@kl-rewards.demo / BrewOwner@123
  Canonical:  /orgs/${ORGANIZATION_SEED_SLUGS.kl}/dashboard
  By org id:  /orgs/${ORGANIZATION_SEED_IDS.klOrganization}/dashboard

Jonker Street Kitchen — jonker.owner@melaka-rewards.demo / JonkerOwner@123
  Locations:  Bukit Katil (primary), Bukit Beruang
  Canonical:  /orgs/${ORGANIZATION_SEED_SLUGS.mlk}/dashboard
  By org id:  /orgs/${ORGANIZATION_SEED_IDS.mlkOrganization}/dashboard

UUID paths redirect to the canonical slug URL after login.
`);
}
