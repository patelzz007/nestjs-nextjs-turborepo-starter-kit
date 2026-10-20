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

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { FakeMerchantAccessPort } from "../../../../platform/application/__tests__/fakes/fake-merchant-access.port";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError, ConflictError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { AuthorizationDeniedError } from "../../../../platform/domain/errors/authorization-denied.error";
import { RewardImageNotFoundError, RewardJustSoldOutError, RewardNotFoundError, RewardReservationMissingError } from "../../domain/errors/reward.errors";
import { NOW, TENANT_ID, REFERRER_ID, referrerRow, REWARD_ID, rewardState, STORE_A } from "../../domain/__tests__/reward-state.fixture";
import { AcceptLegalTermsCommand } from "../commands/accept-legal-terms/accept-legal-terms.command";
import { AcceptLegalTermsHandler } from "../commands/accept-legal-terms/accept-legal-terms.handler";
import type { DueForAutoPublish, LegalAcceptanceReadPort, RewardImageDeliveryPort, RewardImagesArchive, RewardReadPort } from "../ports/reward-read.port";
import { GetLegalAcceptanceStatusQuery } from "../queries/get-legal-acceptance-status/get-legal-acceptance-status.query";
import { GetLegalAcceptanceStatusHandler } from "../queries/get-legal-acceptance-status/get-legal-acceptance-status.handler";
import { GetTenantRewardQuery } from "../queries/get-tenant-reward/get-tenant-reward.query";
import { GetTenantRewardHandler } from "../queries/get-tenant-reward/get-tenant-reward.handler";
import { GetPublishedRewardQuery } from "../queries/get-published-reward/get-published-reward.query";
import { GetPublishedRewardHandler } from "../queries/get-published-reward/get-published-reward.handler";
import { GetRewardForAdminQuery } from "../queries/get-reward-for-admin/get-reward-for-admin.query";
import { GetRewardForAdminHandler } from "../queries/get-reward-for-admin/get-reward-for-admin.handler";
import { GetRewardImageDownloadUrlQuery } from "../queries/get-reward-image-download-url/get-reward-image-download-url.query";
import { GetRewardImageDownloadUrlHandler } from "../queries/get-reward-image-download-url/get-reward-image-download-url.handler";
import { GetRewardImagesArchiveQuery } from "../queries/get-reward-images-archive/get-reward-images-archive.query";
import { GetRewardImagesArchiveHandler } from "../queries/get-reward-images-archive/get-reward-images-archive.handler";
import { ListMarketplaceRewardsQuery } from "../queries/list-marketplace-rewards/list-marketplace-rewards.query";
import { ListMarketplaceRewardsHandler } from "../queries/list-marketplace-rewards/list-marketplace-rewards.handler";
import { ListTenantRewardsQuery } from "../queries/list-tenant-rewards/list-tenant-rewards.query";
import { ListTenantRewardsHandler } from "../queries/list-tenant-rewards/list-tenant-rewards.handler";
import { SummarizeTenantRewardsHandler } from "../queries/summarize-tenant-rewards/summarize-tenant-rewards.handler";
import { SummarizeTenantRewardsQuery } from "../queries/summarize-tenant-rewards/summarize-tenant-rewards.query";
import { ListRewardsPendingReviewQuery } from "../queries/list-rewards-pending-review/list-rewards-pending-review.query";
import { ListRewardsPendingReviewHandler } from "../queries/list-rewards-pending-review/list-rewards-pending-review.handler";
import { RewardInventoryApplicationService } from "../services/reward-inventory.application-service";
import type { RewardsScope } from "../rewards-scope";
import { fakeRewardResponse, fakeRewardsScope } from "./fakes/rewards-scope.fakes";
import { apiKeyActor, userActor } from "./reward-test-actors";

const VISIBLE = fakeRewardResponse(REWARD_ID, TENANT_ID, "PUBLISHED", "Free coffee");
const OTHER_REWARD_ID = "0199a1b2-0000-7000-8000-0000000000f1";

/** A real read port over a fixed list: answers by id and records the grant it was asked with. */
class FixedRewardReads implements RewardReadPort {
	public readonly grants: MerchantAccessGrant[] = [];

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

	public listMarketplace(_actor: ActorContext, query: RewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
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
		await expect(new GetTenantRewardHandler(access, reads).execute(new GetTenantRewardQuery(userActor(), { tenantId: TENANT_ID, rewardId: REWARD_ID }))).rejects.toThrow(
			RewardNotFoundError,
		);
		access.deny("merchant:view_rewards");
		await expect(new GetTenantRewardHandler(access, reads).execute(new GetTenantRewardQuery(userActor(), { tenantId: TENANT_ID, rewardId: REWARD_ID }))).rejects.toThrow(
			AuthorizationDeniedError,
		);
	});
});

describe("review and marketplace queries", () => {
	it("returns the moderation queue page and a reward in full; a missing reward is 404", async () => {
		const reads = new FixedRewardReads([VISIBLE]);
		const page = await new ListRewardsPendingReviewHandler(reads).execute(new ListRewardsPendingReviewQuery(userActor(), { limit: 25, page: 1 }));
		expect(page.items).toEqual([VISIBLE]);
		await expect(new GetRewardForAdminHandler(reads).execute(new GetRewardForAdminQuery(userActor(), { rewardId: REWARD_ID }))).resolves.toEqual(VISIBLE);
		await expect(new GetRewardForAdminHandler(new FixedRewardReads([])).execute(new GetRewardForAdminQuery(userActor(), { rewardId: REWARD_ID }))).rejects.toThrow(
			RewardNotFoundError,
		);
	});

	it("serves only published rewards publicly", async () => {
		const draft = fakeRewardResponse(REWARD_ID, TENANT_ID, "DRAFT", "Hidden");
		await expect(new GetPublishedRewardHandler(new FixedRewardReads([draft])).execute(new GetPublishedRewardQuery(userActor(), { rewardId: REWARD_ID }))).rejects.toThrow(
			RewardNotFoundError,
		);
		const empty = await new ListMarketplaceRewardsHandler(new FixedRewardReads([])).execute(new ListMarketplaceRewardsQuery(userActor(), { limit: 25, page: 1 }));
		expect(empty.items).toEqual([]);
	});

	it("downloads a reward's image and archive; any other file or reward is 404", async () => {
		const file: AdminRewardImageDownloadResponse = { fileId: STORE_A, fileName: "coffee.jpg", downloadUrl: "https://cdn.example.com/coffee.jpg", expiresAt: epochMs(NOW) };
		const delivery = new FixedImageDelivery(file);
		await expect(
			new GetRewardImageDownloadUrlHandler(delivery).execute(new GetRewardImageDownloadUrlQuery(userActor(), { rewardId: REWARD_ID, fileId: STORE_A })),
		).resolves.toEqual(file);
		await expect(
			new GetRewardImageDownloadUrlHandler(delivery).execute(new GetRewardImageDownloadUrlQuery(userActor(), { rewardId: REWARD_ID, fileId: REWARD_ID })),
		).rejects.toThrow(RewardImageNotFoundError);
		const archive = await new GetRewardImagesArchiveHandler(delivery).execute(new GetRewardImagesArchiveQuery(userActor(), { rewardId: REWARD_ID }));
		expect(archive.fileName).toBe("free-coffee-photos.zip");
		await expect(
			new GetRewardImagesArchiveHandler(new FixedImageDelivery(null)).execute(new GetRewardImagesArchiveQuery(userActor(), { rewardId: REWARD_ID })),
		).rejects.toThrow(RewardImageNotFoundError);
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
		await expect(new GetLegalAcceptanceStatusHandler(reads).execute(new GetLegalAcceptanceStatusQuery(userActor("cccccccc-cccc-4ccc-8ccc-cccccccccccc")))).resolves.toEqual(
			status,
		);
		expect(asked).toEqual(["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]);
	});
});

describe("RewardInventoryApplicationService", () => {
	it("reserves under the row lock and saves the counters", async () => {
		const scope = fakeRewardsScope();
		scope.rewards.seed(rewardState("PUBLISHED", { inventory: { quantityTotal: 1, quantityRemaining: 1, quantityReserved: 0, claimCount: 0, redemptionCount: 0 } }));
		const inventory = new RewardInventoryApplicationService(scope.rewards);
		const facts = await inventory.reserve(REWARD_ID, NOW);
		expect(facts.rewardId).toBe(REWARD_ID);
		expect(scope.rewards.lockedForInventory).toEqual([REWARD_ID]);
		expect(scope.rewards.rows.get(REWARD_ID)?.inventory).toMatchObject({ quantityRemaining: 0, quantityReserved: 1, claimCount: 1 });
		await expect(inventory.reserve(REWARD_ID, NOW)).rejects.toThrow(RewardJustSoldOutError);
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
		await expect(inventory.assertClaimable(REWARD_ID, NOW)).resolves.toMatchObject({ rewardId: REWARD_ID, maxClaimsPerUser: null });
		expect(scope.rewards.lockedForInventory).toEqual([]);
		scope.rewards.forceConflictOnNextSave();
		await expect(inventory.reserve(REWARD_ID, NOW)).rejects.toThrow(ConflictError);
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
