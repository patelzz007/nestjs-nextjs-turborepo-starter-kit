import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { epochMs, MERCHANT_CAPABILITY, type OrganizationMembershipRole, type OrganizationRewardMembershipResponse } from "@workspace/shared";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../../organization/services/organization-audit.service";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MerchantContextService } from "./merchant-context.service";

vi.mock("../../organization/services/organization-context.service", () => ({
	OrganizationContextService: class {},
}));

const actor: MerchantActor = { kind: "user", userId: "user-1", organizationId: "org-1", orgSlug: "brew", apiKeyId: null };
const apiKeyActor: MerchantActor = { kind: "api_key", userId: null, organizationId: "org-1", orgSlug: null, apiKeyId: "key-1" };

function membership(role: OrganizationMembershipRole): OrganizationRewardMembershipResponse {
	return {
		organizationId: "org-1",
		organizationSlug: "brew",
		displayName: "Brew",
		role,
		kybStatus: "APPROVED",
		lifecycleState: "ACTIVE",
		createdAt: epochMs(0),
	};
}

interface ServiceUnderTest {
	readonly merchantContext: MerchantContextService;
	readonly requireCedarAction: Mock;
}

/** Real MerchantContextService + real OrganizationRewardAuthService; only slug resolution and the Cedar call are stubbed. */
function serviceAs(role: OrganizationMembershipRole): ServiceUnderTest {
	const tenantTx = new TenantTransactionService(createTestPrisma());
	const cedar = new CedarPolicyEvaluatorService(tenantTx);
	const audit = new OrganizationAuditService(tenantTx);
	const organizationContext = new OrganizationContextService(tenantTx, cedar, audit);
	const organizationRewardAuth = new OrganizationRewardAuthService(tenantTx, organizationContext, cedar, audit);
	vi.spyOn(organizationRewardAuth, "resolveOrganizationFromSlug").mockResolvedValue({
		organizationId: "org-1",
		slug: "brew",
		userId: "user-1",
		membership: membership(role),
		policyVersion: 1,
	});
	const requireCedarAction = vi.fn().mockResolvedValue(undefined);
	vi.spyOn(organizationRewardAuth, "requireCedarAction").mockImplementation(requireCedarAction);
	return { merchantContext: new MerchantContextService(organizationRewardAuth, organizationContext), requireCedarAction };
}

/**
 * The merchant role table (shared with the merchant app) is enforced before
 * tenant Cedar policies — the default policy permits CASHIER for every action,
 * so without this gate cashiers could manage rewards and API keys.
 */
describe("MerchantContextService role gate", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("lets owners manage rewards (then defers to Cedar)", async () => {
		const { merchantContext, requireCedarAction } = serviceAs("OWNER");

		await expect(merchantContext.requireActorCapability(actor, MERCHANT_CAPABILITY.manageRewards)).resolves.toBeUndefined();
		expect(requireCedarAction).toHaveBeenCalledWith("user-1", "org-1", "rewardhub:manage_rewards", "RewardHub", "org-1", "OWNER");
	});

	it("keeps cashiers read-only even though the default Cedar policy permits them", async () => {
		const { merchantContext } = serviceAs("CASHIER");

		await expect(merchantContext.requireActorCapability(actor, MERCHANT_CAPABILITY.viewRedemptions)).resolves.toBeUndefined();
		await expect(merchantContext.requireActorCapability(actor, MERCHANT_CAPABILITY.manageRewards)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(merchantContext.requireUserCapability("user-1", "brew", MERCHANT_CAPABILITY.manageApiKeys)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("gives policy admins no operational access", async () => {
		const { merchantContext, requireCedarAction } = serviceAs("POLICY_ADMIN");

		await expect(merchantContext.requireActorCapability(actor, MERCHANT_CAPABILITY.viewRewards)).rejects.toBeInstanceOf(ForbiddenException);
		expect(requireCedarAction).not.toHaveBeenCalled();
	});

	it("limits business verification (KYB) to owners through merchant:manage_verification", async () => {
		const admin = serviceAs("ADMIN");
		await expect(admin.merchantContext.requireUserCapability("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).rejects.toMatchObject({
			response: { error: "ORGANIZATION_ROLE_CAPABILITY_REQUIRED" },
		});
		expect(admin.requireCedarAction).not.toHaveBeenCalled();

		const owner = serviceAs("OWNER");
		await expect(owner.merchantContext.requireUserCapability("user-1", "brew", MERCHANT_CAPABILITY.manageVerification)).resolves.toBeUndefined();
		expect(owner.requireCedarAction).toHaveBeenCalledWith("user-1", "org-1", "rewardhub:manage_verification", "RewardHub", "org-1", "OWNER");
	});

	it("never lets a POS API key manage the team, locations, or verification", async () => {
		const { merchantContext } = serviceAs("OWNER");

		for (const capability of [
			MERCHANT_CAPABILITY.manageTeam,
			MERCHANT_CAPABILITY.manageLocations,
			MERCHANT_CAPABILITY.manageVerification,
			MERCHANT_CAPABILITY.manageApiKeys,
		]) {
			await expect(merchantContext.requireActorCapability(apiKeyActor, capability)).rejects.toMatchObject({ response: { error: "ORGANIZATION_API_KEY_CAPABILITY_REQUIRED" } });
		}
		await expect(merchantContext.requireActorCapability(apiKeyActor, MERCHANT_CAPABILITY.viewRewards)).resolves.toBeUndefined();
	});
});
