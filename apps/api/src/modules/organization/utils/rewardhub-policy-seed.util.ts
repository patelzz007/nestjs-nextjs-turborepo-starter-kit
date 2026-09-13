import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

type PolicySeedClient = Pick<PrismaClient, "authorizationPolicyDraft" | "authorizationPolicyVersion">;

const REWARDHUB_OWNER_CEDAR = `permit(principal, action, resource) when { principal.role == "OWNER" || principal.role == "ADMIN" };`;
const REWARDHUB_CASHIER_CEDAR = `permit(principal, action, resource) when { principal.role == "CASHIER" };`;

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/** Idempotently publish default RewardHub TENANT Cedar policies for an organization. */
export async function seedRewardHubTenantPolicies(tx: PolicySeedClient, organizationId: string, actorUserId: string): Promise<void> {
	const existing = await tx.authorizationPolicyVersion.findFirst({
		where: { organizationId, scope: "TENANT", supersededAt: null },
	});

	if (existing !== null) {
		return;
	}

	const cedarSource = `${REWARDHUB_OWNER_CEDAR}\n${REWARDHUB_CASHIER_CEDAR}`;
	const draft = await tx.authorizationPolicyDraft.create({
		data: {
			organizationId,
			scope: "TENANT",
			name: "RewardHub role access",
			description: "Default RewardHub Cedar permits for organization members",
			builderPayload: { templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER", "ADMIN", "CASHIER"] } },
			cedarSource,
			status: "PUBLISHED",
			createdById: actorUserId,
			approvedById: actorUserId,
		},
	});

	await tx.authorizationPolicyVersion.create({
		data: {
			organizationId,
			draftId: draft.id,
			scope: "TENANT",
			version: 1,
			cedarSource,
			contentHash: sha256Hex(cedarSource),
			publishedAt: BigInt(Date.now()),
			publishedById: actorUserId,
		},
	});
}
