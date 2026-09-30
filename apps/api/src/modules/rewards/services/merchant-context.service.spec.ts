import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { MERCHANT_CAPABILITY, type OrganizationMembershipRole, type OrganizationRewardMembershipResponse } from "@workspace/shared";

import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MerchantContextService } from "./merchant-context.service";

const mocks = vi.hoisted(() => ({
	resolveOrganizationFromSlug: vi.fn(),
	requireCedarAction: vi.fn(),
}));

vi.mock("../../organization/services/organization-reward-auth.service", () => ({
	OrganizationRewardAuthService: class {
		public readonly resolveOrganizationFromSlug = mocks.resolveOrganizationFromSlug;
		public readonly requireCedarAction = mocks.requireCedarAction;
	},
}));

vi.mock("../../organization/services/organization-context.service", () => ({
	OrganizationContextService: class {},
}));

const actor: MerchantActor = { kind: "user", userId: "user-1", organizationId: "org-1", orgSlug: "brew", apiKeyId: null };

function membership(role: OrganizationMembershipRole): OrganizationRewardMembershipResponse {
	return {
		organizationId: "org-1",
		organizationSlug: "brew",
		displayName: "Brew",
		role,
		kybStatus: "APPROVED",
		lifecycleState: "ACTIVE",
		createdAt: 0,
	};
}

function resolvedAs(role: OrganizationMembershipRole): void {
	mocks.resolveOrganizationFromSlug.mockResolvedValue({ organizationId: "org-1", slug: "brew", userId: "user-1", membership: membership(role), policyVersion: 1 });
}

const service = (): MerchantContextService => new MerchantContextService(new OrganizationRewardAuthService(), new OrganizationContextService());

/**
 * The merchant role table (shared with the merchant app) is enforced before
 * tenant Cedar policies — the default policy permits CASHIER for every action,
 * so without this gate cashiers could manage rewards and API keys.
 */
describe("MerchantContextService role gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireCedarAction.mockResolvedValue(undefined);
	});

	it("lets owners manage rewards (then defers to Cedar)", async () => {
		resolvedAs("OWNER");

		await expect(service().requireActorCapability(actor, MERCHANT_CAPABILITY.manageRewards)).resolves.toBeUndefined();
		expect(mocks.requireCedarAction).toHaveBeenCalledWith("user-1", "org-1", "rewardhub:manage_rewards", "RewardHub", "org-1", expect.objectContaining({ role: "OWNER" }));
	});

	it("keeps cashiers read-only even though the default Cedar policy permits them", async () => {
		resolvedAs("CASHIER");

		await expect(service().requireActorCapability(actor, MERCHANT_CAPABILITY.viewRedemptions)).resolves.toBeUndefined();
		await expect(service().requireActorCapability(actor, MERCHANT_CAPABILITY.manageRewards)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service().requireUserCapability("user-1", "brew", MERCHANT_CAPABILITY.manageApiKeys)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("gives policy admins no operational access", async () => {
		resolvedAs("POLICY_ADMIN");

		await expect(service().requireActorCapability(actor, MERCHANT_CAPABILITY.viewRewards)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mocks.requireCedarAction).not.toHaveBeenCalled();
	});

	it("requires the OWNER role for owner-only actions such as KYB", async () => {
		resolvedAs("ADMIN");
		await expect(service().requireOwnerRole("user-1", "org-1", "brew")).rejects.toBeInstanceOf(ForbiddenException);

		resolvedAs("OWNER");
		await expect(service().requireOwnerRole("user-1", "org-1", "brew")).resolves.toBeUndefined();
	});
});
