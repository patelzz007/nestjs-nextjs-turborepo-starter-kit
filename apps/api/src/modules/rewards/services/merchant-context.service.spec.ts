import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { epochMs, MERCHANT_CAPABILITY, type OrganizationMembershipRole, type OrganizationRewardMembershipResponse } from "@workspace/shared";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { CedarWasmPolicyEngine } from "../../authorization-cedar/engine/cedar-wasm-policy-engine";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../../organization/services/organization-audit.service";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MerchantContextService } from "./merchant-context.service";
import { RequestContextService } from "../../../common/context/request-context";

vi.mock("../../organization/services/organization-context.service", () => ({
	OrganizationContextService: class {},
}));

const actor: MerchantActor = { kind: "user", userId: "user-1", organizationId: "org-1", orgSlug: "brew" };
const apiKeyActor: MerchantActor = { kind: "api_key", organizationId: "org-1", apiKeyId: "key-1", keyScope: "INTEGRATION", keyLocationId: null };
const posKeyActor: MerchantActor = { kind: "api_key", organizationId: "org-1", apiKeyId: "key-2", keyScope: "POS", keyLocationId: null };

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
	const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
	const cedar = new CedarPolicyEvaluatorService(tenantTx, new CedarWasmPolicyEngine());
	const audit = new OrganizationAuditService();
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

	it("gives a paired till's POS key no organization capability at all", async () => {
		const { merchantContext } = serviceAs("OWNER");

		for (const capability of [MERCHANT_CAPABILITY.viewRewards, MERCHANT_CAPABILITY.manageRewards, MERCHANT_CAPABILITY.viewRedemptions, MERCHANT_CAPABILITY.viewAnalytics]) {
			await expect(merchantContext.requireActorCapability(posKeyActor, capability)).rejects.toMatchObject({ response: { error: "ORGANIZATION_API_KEY_CAPABILITY_REQUIRED" } });
		}
	});

	it("never lets an integration API key manage the team, locations, or verification", async () => {
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

const STORE_A = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const STORE_B = "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50";

interface ScopeServiceUnderTest {
	readonly merchantContext: MerchantContextService;
	readonly assertAccessibleLocation: Mock;
}

/** MerchantContextService over a membership with the given store scope (slug resolution and the location check stubbed). */
function scopedService(locationScopeType: "ALL_LOCATIONS" | "SELECTED", locationIds: readonly string[]): ScopeServiceUnderTest {
	const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
	const cedar = new CedarPolicyEvaluatorService(tenantTx, new CedarWasmPolicyEngine());
	const audit = new OrganizationAuditService();
	const organizationContext = new OrganizationContextService(tenantTx, cedar, audit);
	const assertAccessibleLocation = vi.fn().mockResolvedValue(undefined);
	Object.assign(organizationContext, {
		assertAccessibleLocation,
		resolveBySlug: vi.fn().mockResolvedValue({
			organizationId: "org-1",
			slug: "brew",
			userId: "user-1",
			policyVersion: 1,
			membership: {
				id: "membership-1",
				organizationId: "org-1",
				userId: "user-1",
				role: "CASHIER",
				status: "ACTIVE",
				displayName: null,
				locationScopeType,
				locationIds: [...locationIds],
				createdAt: epochMs(0),
				updatedAt: epochMs(0),
			},
		}),
	});
	const organizationRewardAuth = new OrganizationRewardAuthService(tenantTx, organizationContext, cedar, audit);
	return { merchantContext: new MerchantContextService(organizationRewardAuth, organizationContext), assertAccessibleLocation };
}

/**
 * Store scope is resolved server-side for every merchant read: omitting
 * `locationId` must never mean "every store" for a store-limited member or a
 * store-scoped API key.
 */
describe("MerchantContextService location scope", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("limits a store-limited member who names no store to exactly that member's stores", async () => {
		const { merchantContext } = scopedService("SELECTED", [STORE_A]);

		await expect(merchantContext.resolveLocationScope(actor, undefined)).resolves.toEqual({ kind: "SELECTED_LOCATIONS", locationIds: [STORE_A] });
	});

	it("gives an all-stores member every store when no store is named", async () => {
		const { merchantContext } = scopedService("ALL_LOCATIONS", []);

		await expect(merchantContext.resolveLocationScope(actor, undefined)).resolves.toEqual({ kind: "ALL_LOCATIONS" });
	});

	it("checks a named store against the member's scope before narrowing to it", async () => {
		const { merchantContext, assertAccessibleLocation } = scopedService("SELECTED", [STORE_A]);
		assertAccessibleLocation.mockRejectedValueOnce(new ForbiddenException({ error: "ORGANIZATION_LOCATION_FORBIDDEN" }));

		await expect(merchantContext.resolveLocationScope(actor, STORE_B)).rejects.toBeInstanceOf(ForbiddenException);
		expect(assertAccessibleLocation).toHaveBeenCalledWith("user-1", "brew", STORE_B);
		await expect(merchantContext.resolveLocationScope(actor, STORE_A)).resolves.toEqual({ kind: "SELECTED_LOCATIONS", locationIds: [STORE_A] });
	});

	it("keeps a store-scoped API key on its own store and refuses another", async () => {
		const { merchantContext } = scopedService("ALL_LOCATIONS", []);
		const storeKey: MerchantActor = { ...apiKeyActor, keyLocationId: STORE_A };

		await expect(merchantContext.resolveLocationScope(storeKey, undefined)).resolves.toEqual({ kind: "SELECTED_LOCATIONS", locationIds: [STORE_A] });
		await expect(merchantContext.resolveLocationScope(storeKey, STORE_A)).resolves.toEqual({ kind: "SELECTED_LOCATIONS", locationIds: [STORE_A] });
		await expect(merchantContext.resolveLocationScope(storeKey, STORE_B)).rejects.toMatchObject({ response: { error: "API_KEY_LOCATION_FORBIDDEN" } });
	});

	it("lets an organization-wide API key see every store or narrow to one", async () => {
		const { merchantContext } = scopedService("ALL_LOCATIONS", []);

		await expect(merchantContext.resolveLocationScope(apiKeyActor, undefined)).resolves.toEqual({ kind: "ALL_LOCATIONS" });
		await expect(merchantContext.resolveLocationScope(apiKeyActor, STORE_B)).resolves.toEqual({ kind: "SELECTED_LOCATIONS", locationIds: [STORE_B] });
	});
});
