import { Readable } from "node:stream";

import type {
	AdminPendingRewardListQuery,
	AdminRewardImageDownloadResponse,
	MerchantRewardListQuery,
	MerchantRewardSummary,
	PaginatedServiceResult,
	RewardClaimCheckoutStatus,
	RewardListQuery,
	RewardResponse,
} from "@workspace/shared";
import { epochMs, MerchantRewardSummarySchema, RewardStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FakeCustomerTierAccess } from "../../../../platform/application/__tests__/fake-customer-tier-access";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import type { CustomerTierAccess } from "../../../../platform/domain/customer-tier-access";
import { FakeMerchantAccessPort } from "../../../../platform/application/__tests__/fakes/fake-merchant-access.port";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError, ConflictError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { AuthorizationDeniedError } from "../../../../platform/domain/errors/authorization-denied.error";
import {
	RewardImageNotFoundError,
	RewardJustSoldOutError,
	RewardNotFoundError,
	RewardReservationMissingError,
	RewardSoldOutError,
	RewardTierLockedError,
} from "../../domain/errors/reward.errors";
import { CUSTOMER_ID, NOW, REFERRER_ID, referrerRow, REWARD_ID, rewardState, STORE_A, TENANT_ID, TIERS_OFF } from "../../domain/__tests__/reward-state.fixture";
import { AcceptLegalTermsCommand } from "../commands/accept-legal-terms/accept-legal-terms.command";
import { AcceptLegalTermsHandler } from "../commands/accept-legal-terms/accept-legal-terms.handler";
import type { DueForAutoPublish, LegalAcceptanceReadPort, RewardImageDeliveryPort, RewardImagesArchive, RewardReadPort } from "../ports/reward-read.port";
import { GetRewardAudienceHandler } from "../queries/get-reward-audience/get-reward-audience.handler";
import { GetRewardAudienceQuery } from "../queries/get-reward-audience/get-reward-audience.query";
import { ListRewardCustomersHandler } from "../queries/list-reward-customers/list-reward-customers.handler";
import { ListRewardCustomersQuery } from "../queries/list-reward-customers/list-reward-customers.query";
import { RewardAudience } from "../../domain/value-objects/reward-audience.value-object";
import { REWARD_CUSTOMERS_READ_OPERATION } from "../ports/rewards.tokens";
import { GetTenantRewardQuery } from "../queries/get-tenant-reward/get-tenant-reward.query";
import { GetTenantRewardHandler } from "../queries/get-tenant-reward/get-tenant-reward.handler";
import { ListMarketplaceRewardsQuery } from "../queries/list-marketplace-rewards/list-marketplace-rewards.query";
import { ListMarketplaceRewardsHandler } from "../queries/list-marketplace-rewards/list-marketplace-rewards.handler";
import { ListTenantRewardsQuery } from "../queries/list-tenant-rewards/list-tenant-rewards.query";
import { ListTenantRewardsHandler } from "../queries/list-tenant-rewards/list-tenant-rewards.handler";
import { SummarizeTenantRewardsHandler } from "../queries/summarize-tenant-rewards/summarize-tenant-rewards.handler";
import { SummarizeTenantRewardsQuery } from "../queries/summarize-tenant-rewards/summarize-tenant-rewards.query";
import { LegalAcceptanceApplicationService } from "../services/legal-acceptance.application-service";
import { RewardApplicationService } from "../services/reward.application-service";
import { RewardImageApplicationService } from "../services/reward-image.application-service";
import { RewardInventoryApplicationService } from "../services/reward-inventory.application-service";
import type { RewardsScope } from "../rewards-scope";
import { fakeRewardResponse, fakeRewardsScope } from "./fakes/rewards-scope.fakes";
import { apiKeyActor, MERCHANT_USER_ID, userActor } from "./reward-test-actors";

const VISIBLE = fakeRewardResponse(REWARD_ID, TENANT_ID, "PUBLISHED", "Free coffee");
const OTHER_REWARD_ID = "0199a1b2-0000-7000-8000-0000000000f1";

/** A real read port over a fixed list: answers by id and records the grant it was asked with. */
class FixedRewardReads implements RewardReadPort {
	public readonly grants: MerchantAccessGrant[] = [];
	/** The tier access each marketplace page was asked for (ADR 085). */
	public readonly marketplaceTierAccess: CustomerTierAccess[] = [];

	public constructor(private readonly rewards: readonly RewardResponse[]) {}

	public listTenantRewards(_actor: ActorContext, grant: MerchantAccessGrant, query: MerchantRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		this.grants.push(grant);
		return Promise.resolve({
			items: [...this.rewards],
			limit: query.limit,
			total: this.rewards.length,
			page: 1,
			totalPages: 1,
			nextCursor: null,
			hasNext: false,
			hasPrevious: false,
		});
	}

	public summarizeTenantRewards(_actor: ActorContext, grant: MerchantAccessGrant): Promise<MerchantRewardSummary> {
		this.grants.push(grant);
		const countsByStatus = MerchantRewardSummarySchema.shape.countsByStatus.parse(
			Object.fromEntries(RewardStatusSchema.options.map((status) => [status, this.rewards.filter((reward) => reward.status === status).length])),
		);
		return Promise.resolve({ countsByStatus, unitsRemaining: this.rewards.reduce((sum, reward) => sum + reward.quantityRemaining, 0) });
	}

	public findTenantReward(_actor: ActorContext, grant: MerchantAccessGrant, rewardId: string): Promise<RewardResponse | null> {
		this.grants.push(grant);
		return Promise.resolve(this.rewards.find((reward) => reward.id === rewardId) ?? null);
	}

	public listPendingReview(_actor: ActorContext, query: AdminPendingRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return Promise.resolve({
			items: [...this.rewards],
			limit: query.limit,
			total: this.rewards.length,
			page: 1,
			totalPages: 1,
			nextCursor: null,
			hasNext: false,
			hasPrevious: false,
		});
	}

	public findConsumerForReview(_actor: ActorContext, rewardId: string): Promise<RewardResponse | null> {
		return Promise.resolve(this.rewards.find((reward) => reward.id === rewardId) ?? null);
	}

	public listMarketplace(_actor: ActorContext, query: RewardListQuery, tierAccess: CustomerTierAccess): Promise<PaginatedServiceResult<RewardResponse>> {
		this.marketplaceTierAccess.push(tierAccess);
		return Promise.resolve({ items: [], limit: query.limit, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false });
	}

	public findPublished(_actor: ActorContext, rewardId: string): Promise<RewardResponse | null> {
		return Promise.resolve(this.rewards.find((reward) => reward.id === rewardId && reward.status === "PUBLISHED") ?? null);
	}

	public listDueForAutoPublish(): Promise<readonly DueForAutoPublish[]> {
		return Promise.resolve([]);
	}
}

class FixedImageDelivery implements RewardImageDeliveryPort {
	public constructor(private readonly file: AdminRewardImageDownloadResponse | null) {}

	public downloadUrl(_actor: ActorContext, rewardId: string, fileId: string): Promise<AdminRewardImageDownloadResponse | null> {
		return Promise.resolve(rewardId === REWARD_ID && this.file?.fileId === fileId ? this.file : null);
	}

	public archive(_actor: ActorContext, rewardId: string): Promise<RewardImagesArchive | null> {
		return Promise.resolve(
			rewardId === REWARD_ID && this.file !== null ? { fileName: "free-coffee-photos.zip", contentType: "application/zip", body: Readable.from([]) } : null,
		);
	}
}

describe("merchant reward queries", () => {
	it("lists with the caller's store scope narrowed to the requested store", async () => {
		const access = new FakeMerchantAccessPort().grantLocations([STORE_A]);
		const reads = new FixedRewardReads([VISIBLE]);
		const rewards = await new ListTenantRewardsHandler(access, reads).execute(
			new ListTenantRewardsQuery(userActor(), { tenantId: TENANT_ID, locationId: STORE_A, page: 1, limit: 20 }),
		);
		expect(rewards.items).toEqual([VISIBLE]);
		expect(access.requests.at(0)?.request).toEqual({ tenantId: TENANT_ID, capability: "merchant:view_rewards", locationId: STORE_A });
		expect(reads.grants).toEqual([{ tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_A] }]);
	});

	it("summarizes every reward in the caller's store scope behind the same view capability", async () => {
		const access = new FakeMerchantAccessPort().grantLocations([STORE_A]);
		const reads = new FixedRewardReads([VISIBLE, fakeRewardResponse(OTHER_REWARD_ID, TENANT_ID, "DRAFT", "Muffin")]);

		const summary = await new SummarizeTenantRewardsHandler(access, reads).execute(new SummarizeTenantRewardsQuery(userActor(), { tenantId: TENANT_ID, locationId: STORE_A }));

		expect(summary.countsByStatus).toMatchObject({ PUBLISHED: 1, DRAFT: 1, PENDING_REVIEW: 0 });
		expect(summary.unitsRemaining).toBe(VISIBLE.quantityRemaining * 2);
		expect(access.requests.at(0)?.request).toEqual({ tenantId: TENANT_ID, capability: "merchant:view_rewards", locationId: STORE_A });
		expect(reads.grants).toEqual([{ tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_A] }]);
	});

	it("answers 404 for a reward not offered at the caller's stores, and nothing at all without the capability", async () => {
		const access = new FakeMerchantAccessPort();
		const reads = new FixedRewardReads([]);
		await expect(
			new GetTenantRewardHandler(access, access, reads).execute(new GetTenantRewardQuery(userActor(), { tenantId: TENANT_ID, rewardId: REWARD_ID })),
		).rejects.toThrow(RewardNotFoundError);
		access.deny("merchant:view_rewards");
		await expect(
			new GetTenantRewardHandler(access, access, reads).execute(new GetTenantRewardQuery(userActor(), { tenantId: TENANT_ID, rewardId: REWARD_ID })),
		).rejects.toThrow(AuthorizationDeniedError);
	});

	it("decides the read for this reward, and tells a member what this reward allows them", async () => {
		const access = new FakeMerchantAccessPort().deny("merchant:publish_rewards");
		const reward = await new GetTenantRewardHandler(access, access, new FixedRewardReads([VISIBLE])).execute(
			new GetTenantRewardQuery(userActor(), { tenantId: TENANT_ID, rewardId: VISIBLE.id }),
		);
		expect(reward.viewerCapabilities).toEqual({ update: true, publish: false });
		const target = { resource: "REWARD", resourceId: VISIBLE.id };
		expect(access.requests.map((recorded) => recorded.request)).toEqual([
			{ tenantId: TENANT_ID, capability: "merchant:view_rewards", target },
			{ tenantId: TENANT_ID, capability: "merchant:manage_rewards", target },
			{ tenantId: TENANT_ID, capability: "merchant:publish_rewards", target },
		]);
	});
});

describe("review and marketplace queries", () => {
	it("returns the moderation queue page and a reward in full; a missing reward is 404", async () => {
		const rewards = new RewardApplicationService(new FixedRewardReads([VISIBLE]));
		const page = await rewards.listPendingReview(userActor(), { limit: 25, page: 1 });
		expect(page.items).toEqual([VISIBLE]);
		await expect(rewards.getForReview(userActor(), { rewardId: REWARD_ID })).resolves.toEqual(VISIBLE);
		await expect(new RewardApplicationService(new FixedRewardReads([])).getForReview(userActor(), { rewardId: REWARD_ID })).rejects.toThrow(RewardNotFoundError);
	});

	it("serves only published rewards publicly", async () => {
		const draft = fakeRewardResponse(REWARD_ID, TENANT_ID, "DRAFT", "Hidden");
		const published = fakeRewardResponse(REWARD_ID, TENANT_ID, "PUBLISHED", "Free coffee");
		await expect(new RewardApplicationService(new FixedRewardReads([draft])).getPublished(userActor(), { rewardId: REWARD_ID })).rejects.toThrow(RewardNotFoundError);
		await expect(new RewardApplicationService(new FixedRewardReads([published])).getPublished(userActor(), { rewardId: REWARD_ID })).resolves.toEqual(published);
		const empty = await new ListMarketplaceRewardsHandler(new FixedRewardReads([]), new FakeCustomerTierAccess()).execute(
			new ListMarketplaceRewardsQuery(userActor(), { limit: 25, page: 1 }),
		);
		expect(empty.items).toEqual([]);
	});

	it("lists the marketplace for the viewer's own tier (ADR 085)", async () => {
		const reads = new FixedRewardReads([]);
		const tiers = FakeCustomerTierAccess.on({ [MERCHANT_USER_ID]: "GOLD" });
		await new ListMarketplaceRewardsHandler(reads, tiers).execute(new ListMarketplaceRewardsQuery(userActor(), { limit: 25, page: 1 }));
		expect(reads.marketplaceTierAccess).toEqual([{ kind: "on", tier: "GOLD" }]);
		expect(tiers.askedFor).toEqual([MERCHANT_USER_ID]);
	});

	it("downloads a reward's image and archive; any other file or reward is 404", async () => {
		const file: AdminRewardImageDownloadResponse = { fileId: STORE_A, fileName: "coffee.jpg", downloadUrl: "https://cdn.example.com/coffee.jpg", expiresAt: epochMs(NOW) };
		const images = new RewardImageApplicationService(new FixedImageDelivery(file));
		await expect(images.downloadUrl(userActor(), { rewardId: REWARD_ID, fileId: STORE_A })).resolves.toEqual(file);
		await expect(images.downloadUrl(userActor(), { rewardId: REWARD_ID, fileId: REWARD_ID })).rejects.toThrow(RewardImageNotFoundError);
		const archive = await images.archive(userActor(), { rewardId: REWARD_ID });
		expect(archive.fileName).toBe("free-coffee-photos.zip");
		await expect(new RewardImageApplicationService(new FixedImageDelivery(null)).archive(userActor(), { rewardId: REWARD_ID })).rejects.toThrow(RewardImageNotFoundError);
	});
});

describe("legal acceptance", () => {
	it("appends one acceptance per call for the signed-in customer", async () => {
		const scope = fakeRewardsScope();
		const uow = new InMemoryUnitOfWork<RewardsScope>(scope);
		const handler = new AcceptLegalTermsHandler(uow, new FixedClock(NOW));
		await handler.execute(new AcceptLegalTermsCommand(userActor(), { termsVersion: "v1", privacyVersion: "v1" }));
		await handler.execute(new AcceptLegalTermsCommand(userActor(), { termsVersion: "v2", privacyVersion: "v1" }));
		expect(scope.legalAcceptances.added.map((acceptance) => acceptance.snapshot().termsVersion)).toEqual(["v1", "v2"]);
		await expect(handler.execute(new AcceptLegalTermsCommand(apiKeyActor(TENANT_ID), { termsVersion: "v1", privacyVersion: "v1" }))).rejects.toThrow(AuthenticationError);
	});

	it("reads the caller's own status", async () => {
		const status: RewardClaimCheckoutStatus = { hasAcceptedLegal: true, termsVersion: "v1", privacyVersion: "v1", phone: null, phoneVerified: false };
		const asked: string[] = [];
		const reads: LegalAcceptanceReadPort = {
			checkoutStatus: (_actor: ActorContext, userId: string): Promise<RewardClaimCheckoutStatus> => {
				asked.push(userId);
				return Promise.resolve(status);
			},
		};
		const legal = new LegalAcceptanceApplicationService(reads);
		await expect(legal.checkoutStatus(userActor("cccccccc-cccc-4ccc-8ccc-cccccccccccc"))).resolves.toEqual(status);
		expect(asked).toEqual(["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]);
		await expect(legal.checkoutStatus(apiKeyActor(TENANT_ID))).rejects.toThrow(AuthenticationError);
	});
});

describe("RewardInventoryApplicationService", () => {
	it("reserves under the row lock and saves the counters", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { inventory: { quantityTotal: 1, quantityRemaining: 1, quantityReserved: 0, claimCount: 0, redemptionCount: 0 } }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);
		const facts = await inventory.reserve(REWARD_ID, NOW, CUSTOMER_ID, TIERS_OFF);
		expect(facts.rewardId).toBe(REWARD_ID);
		expect(scope.rewards.lockedForInventory).toEqual([REWARD_ID]);
		expect(scope.rewards.rows.get(REWARD_ID)?.inventory).toMatchObject({ quantityRemaining: 0, quantityReserved: 1, claimCount: 1 });
		await expect(inventory.reserve(REWARD_ID, NOW, CUSTOMER_ID, TIERS_OFF)).rejects.toThrow(RewardJustSoldOutError);
	});

	it("lets the customer holding the last unit through the stock check (it used to drop holdsUnit and answer sold out)", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { inventory: { quantityTotal: 1, quantityRemaining: 0, quantityReserved: 1, claimCount: 0, redemptionCount: 0 } }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);
		await expect(inventory.assertClaimable(REWARD_ID, NOW, CUSTOMER_ID, TIERS_OFF)).rejects.toThrow(RewardSoldOutError);
		await expect(inventory.assertClaimable(REWARD_ID, NOW, CUSTOMER_ID, TIERS_OFF, true)).resolves.toMatchObject({ rewardId: REWARD_ID });
	});

	it("refuses a customer below the reward's minimum tier (ADR 085)", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { audience: RewardAudience.everyone("GOLD") }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);
		await expect(inventory.assertClaimable(REWARD_ID, NOW, CUSTOMER_ID, { kind: "on", tier: "SILVER" })).rejects.toThrow(RewardTierLockedError);
		await expect(inventory.holdUnit(REWARD_ID, NOW, CUSTOMER_ID, { kind: "on", tier: "SILVER" })).rejects.toThrow(RewardTierLockedError);
		await expect(inventory.reserve(REWARD_ID, NOW, CUSTOMER_ID, { kind: "on", tier: "DIAMOND" })).resolves.toMatchObject({ rewardId: REWARD_ID });
	});

	it("releases and records redemptions, refusing either without a reserved unit", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { inventory: { quantityTotal: 2, quantityRemaining: 0, quantityReserved: 2, claimCount: 2, redemptionCount: 0 } }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);
		await inventory.release(REWARD_ID, NOW);
		await inventory.recordRedemption(REWARD_ID, NOW);
		expect(scope.rewards.rows.get(REWARD_ID)?.inventory).toMatchObject({ quantityRemaining: 1, quantityReserved: 0, redemptionCount: 1 });
		await expect(inventory.release(REWARD_ID, NOW)).rejects.toThrow(RewardReservationMissingError);
	});

	it("checks claimability without locking and propagates a lost compare-and-set", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED"));
		const inventory = new RewardInventoryApplicationService(scope.rewards);
		await expect(inventory.assertClaimable(REWARD_ID, NOW, CUSTOMER_ID, TIERS_OFF)).resolves.toMatchObject({ rewardId: REWARD_ID, maxClaimsPerUser: null });
		expect(scope.rewards.lockedForInventory).toEqual([]);
		scope.rewards.forceConflictOnNextSave();
		await expect(inventory.reserve(REWARD_ID, NOW, CUSTOMER_ID, TIERS_OFF)).rejects.toThrow(ConflictError);
	});
	it("locks a checkout's live rewards and their referrer children in one id-ordered pass, skipping unknown ids", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { referrer: referrerRow("PUBLISHED"), referralsEnabled: true, referralPoolTotal: 1, referralPoolRemaining: 1 }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);

		await inventory.lockForCheckout(["missing-reward", REWARD_ID]);

		expect(scope.rewards.lockedForCheckout).toEqual([[REWARD_ID, REFERRER_ID].sort((left, right) => left.localeCompare(right))]);
		expect(scope.rewards.saved).toEqual([]);
	});

	it("credits a referral under the parent-then-child lock and saves the pool and the referrer stock", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { referrer: referrerRow("PUBLISHED"), referralsEnabled: true, referralPoolTotal: 1, referralPoolRemaining: 1 }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);

		await expect(inventory.creditReferral(REWARD_ID, NOW)).resolves.toMatchObject({ referrerRewardId: REFERRER_ID });

		expect(scope.rewards.lockedForReferralCredit).toEqual([REWARD_ID]);
		expect(scope.rewards.rows.get(REWARD_ID)).toMatchObject({
			referralPoolRemaining: 0,
			referrer: { inventory: { quantityRemaining: 2, quantityReserved: 1, claimCount: 1 } },
		});
		expect(scope.rewards.saved).toEqual([REWARD_ID]);
	});

	it("saves nothing when there is nothing left to credit with", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { referrer: referrerRow("PUBLISHED"), referralsEnabled: true, referralPoolTotal: 1, referralPoolRemaining: 0 }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);

		await expect(inventory.creditReferral(REWARD_ID, NOW)).resolves.toBeNull();

		expect(scope.rewards.saved).toEqual([]);
	});
});

describe("the customers a reward is given to", () => {
	const BOB = "0199a1b2-0000-7000-8000-0000000000b2";
	const customer = (userId: string, fullName: string): { userId: string; fullName: string; maskedEmail: string; lastClaimedAt: number; claimCount: number } => ({
		userId,
		fullName,
		maskedEmail: `${fullName.slice(0, 1).toLowerCase()}•••@example.com`,
		lastClaimedAt: NOW,
		claimCount: 1,
	});

	it("lists the tenant's customers by name and masked email, under the customer-read operation", async () => {
		const scope = fakeRewardsScope();
		scope.customers.add(customer(CUSTOMER_ID, "Alice"), customer(BOB, "Bob"));
		const uow = new InMemoryUnitOfWork<RewardsScope>(scope);
		const access = new FakeMerchantAccessPort();
		const page = await new ListRewardCustomersHandler(access, uow, FakeCustomerTierAccess.on({ [BOB]: "GOLD" })).execute(
			new ListRewardCustomersQuery(userActor(), { tenantId: TENANT_ID, search: "bo", page: 1, limit: 20, sort: undefined, filter: undefined }),
		);

		expect(page.items).toEqual([{ userId: BOB, fullName: "Bob", maskedEmail: "b•••@example.com", lastClaimedAt: epochMs(NOW), claimCount: 1, tier: "GOLD" }]);
		expect(access.requests.at(0)?.request).toEqual({ tenantId: TENANT_ID, capability: "merchant:manage_rewards" });
		expect(uow.committed.map((entry) => entry.operation)).toEqual([REWARD_CUSTOMERS_READ_OPERATION]);
	});

	it("answers who a reward was given to, and 404 for a reward the caller may not see", async () => {
		const scope = fakeRewardsScope();
		scope.customers.add(customer(CUSTOMER_ID, "Alice"), customer(BOB, "Bob"));
		scope.rewards.seed(rewardState("DRAFT", { audience: RewardAudience.selected([BOB]) }));
		const handler = new GetRewardAudienceHandler(
			new FakeMerchantAccessPort(),
			new FixedRewardReads([VISIBLE]),
			new InMemoryUnitOfWork<RewardsScope>(scope),
			new FakeCustomerTierAccess(),
		);

		// Tiers off: nobody shows a tier.
		await expect(handler.execute(new GetRewardAudienceQuery(userActor(), { tenantId: TENANT_ID, rewardId: REWARD_ID }))).resolves.toEqual({
			audienceType: "SELECTED_CUSTOMERS",
			customers: [{ userId: BOB, fullName: "Bob", maskedEmail: "b•••@example.com", lastClaimedAt: epochMs(NOW), claimCount: 1, tier: null }],
		});
		await expect(handler.execute(new GetRewardAudienceQuery(userActor(), { tenantId: TENANT_ID, rewardId: OTHER_REWARD_ID }))).rejects.toThrow(RewardNotFoundError);
	});
});
