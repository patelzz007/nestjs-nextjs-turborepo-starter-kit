import { BadRequestException, NotFoundException } from "@nestjs/common";
import { epochMs, LIST_SLOT_INDEX } from "@workspace/shared";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { RewardClaimRepository } from "../repositories/reward-claim.repository";
import { RewardRedemptionRepository } from "../repositories/reward-redemption.repository";
import { RewardImagesUnavailableError, RewardRepository } from "../repositories/reward.repository";
import { MerchantContextService } from "./merchant-context.service";
import { MerchantRewardService } from "./merchant-reward.service";
import { RewardNotificationService } from "./reward-notification.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { ALL_LOCATIONS_SCOPE, selectedLocationsScope } from "../types/merchant-location-scope";
import { createTestPublicUrls } from "../../../../test/support/public-urls";
import { PublicUrlResolver } from "../../../config/public-url.resolver";

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

/** Identity of the reward repository's transaction — the outbox write must use exactly this client. */
const REWARD_TX = new PrismaService(createTestTypedConfig());

const ORGANIZATION_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const REWARD_ID = "7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d";
const CLAIM_ID = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";
const USER_ID = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";
const OWNER_ID = "3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7";

describe("MerchantRewardService maintenance events (transactional outbox)", () => {
	let service: MerchantRewardService;
	const rewardRepository = {
		listPendingAutoPublish: vi.fn(),
		autoPublishInTransaction: vi.fn<RewardRepository["autoPublishInTransaction"]>(),
	};
	const rewardClaimRepository = {
		listExpiredPending: vi.fn(),
		expireClaimInTransaction: vi.fn<RewardClaimRepository["expireClaimInTransaction"]>(),
	};
	const organizationRepository = { listOwnerUserIds: vi.fn<OrganizationRepository["listOwnerUserIds"]>() };
	const notificationService = { notify: vi.fn<RewardNotificationService["notify"]>() };
	const outbox = { enqueueInTransaction: vi.fn<PlatformOutboxService["enqueueInTransaction"]>() };

	beforeEach(async () => {
		vi.clearAllMocks();
		outbox.enqueueInTransaction.mockResolvedValue("evt-1");
		organizationRepository.listOwnerUserIds.mockResolvedValue([OWNER_ID]);
		notificationService.notify.mockResolvedValue(undefined);
		rewardRepository.autoPublishInTransaction.mockImplementation(async (_rewardId, _referrerId, _orgId, _now, withinTransaction): Promise<void> => {
			await withinTransaction(REWARD_TX);
		});
		rewardClaimRepository.expireClaimInTransaction.mockImplementation(async (_claimId, _rewardId, _orgId, _isReferrer, withinTransaction): Promise<boolean> => {
			await withinTransaction(REWARD_TX);
			return true;
		});

		const moduleRef = await Test.createTestingModule({
			providers: [
				{ provide: RewardRepository, useValue: rewardRepository },
				{ provide: RewardClaimRepository, useValue: rewardClaimRepository },
				{ provide: RewardRedemptionRepository, useValue: {} },
				{ provide: MerchantContextService, useValue: {} },
				{ provide: OrganizationRepository, useValue: organizationRepository },
				{ provide: RewardNotificationService, useValue: notificationService },
				{ provide: PlatformOutboxService, useValue: outbox },
			],
		}).compile();

		service = new MerchantRewardService(
			moduleRef.get(RewardRepository),
			moduleRef.get(RewardClaimRepository),
			moduleRef.get(RewardRedemptionRepository),
			moduleRef.get(MerchantContextService),
			moduleRef.get(OrganizationRepository),
			moduleRef.get(RewardNotificationService),
			moduleRef.get(PlatformOutboxService),
			createTestPublicUrls(),
		);
	});

	it("writes reward.auto_published inside the publish transaction", async () => {
		rewardRepository.listPendingAutoPublish.mockResolvedValue([{ id: REWARD_ID, referrerRewardId: null, organizationId: ORGANIZATION_ID, title: "Free coffee" }]);

		await expect(service.autoPublishPendingRewards()).resolves.toBe(1);

		expect(outbox.enqueueInTransaction).toHaveBeenCalledWith(REWARD_TX, {
			type: "reward.platform",
			payload: { event: "reward.auto_published", actorUserId: null, organizationId: ORGANIZATION_ID, metadata: { rewardId: REWARD_ID } },
		});
		expect(notificationService.notify).toHaveBeenCalledTimes(1);
	});

	it("neither records the event nor notifies owners when the publish transaction fails", async () => {
		rewardRepository.listPendingAutoPublish.mockResolvedValue([{ id: REWARD_ID, referrerRewardId: null, organizationId: ORGANIZATION_ID, title: "Free coffee" }]);
		rewardRepository.autoPublishInTransaction.mockRejectedValue(new Error("could not serialize access"));

		await expect(service.autoPublishPendingRewards()).rejects.toThrow("could not serialize access");

		expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
		expect(notificationService.notify).not.toHaveBeenCalled();
	});

	it("writes reward.claim_expired inside the expiry transaction", async () => {
		rewardClaimRepository.listExpiredPending.mockResolvedValue([
			{ id: CLAIM_ID, rewardId: REWARD_ID, userId: USER_ID, isReferrerCredit: false, reward: { organizationId: ORGANIZATION_ID } },
		]);

		await expect(service.expirePendingClaims()).resolves.toBe(1);

		expect(outbox.enqueueInTransaction).toHaveBeenCalledWith(REWARD_TX, {
			type: "reward.platform",
			payload: { event: "reward.claim_expired", actorUserId: USER_ID, organizationId: ORGANIZATION_ID, metadata: { claimId: CLAIM_ID, isReferrerCredit: false } },
		});
	});

	it("writes no event when another worker already expired the claim", async () => {
		rewardClaimRepository.listExpiredPending.mockResolvedValue([
			{ id: CLAIM_ID, rewardId: REWARD_ID, userId: USER_ID, isReferrerCredit: true, reward: { organizationId: ORGANIZATION_ID } },
		]);
		// The repository only runs the same-transaction write when it actually expired the claim.
		rewardClaimRepository.expireClaimInTransaction.mockResolvedValue(false);

		await service.expireReferrerClaims();

		expect(outbox.enqueueInTransaction).not.toHaveBeenCalled();
	});

	it("tags referrer-claim expiry events as referrer credits", async () => {
		rewardClaimRepository.listExpiredPending.mockResolvedValue([
			{ id: CLAIM_ID, rewardId: REWARD_ID, userId: USER_ID, isReferrerCredit: true, reward: { organizationId: ORGANIZATION_ID } },
		]);

		await service.expireReferrerClaims();

		expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.first]).toBe(REWARD_TX);
		// `metadata` is compared exactly (it was a plain object inside the old objectContaining).
		expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second]).toMatchObject({ payload: { event: "reward.claim_expired" } });
		expect(outbox.enqueueInTransaction.mock.lastCall?.[LIST_SLOT_INDEX.second].payload).toHaveProperty("metadata", { claimId: CLAIM_ID, isReferrerCredit: true });
	});
});

describe("MerchantRewardService.getReward (store scope)", () => {
	const STORE_A = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
	const actor = { kind: "user", userId: USER_ID, organizationId: ORGANIZATION_ID, orgSlug: "brew" } satisfies MerchantActor;
	const rewardRepository = { findConsumerByOrganization: vi.fn<RewardRepository["findConsumerByOrganization"]>() };
	const merchantContext = {
		requireActorCapability: vi.fn<MerchantContextService["requireActorCapability"]>(),
		resolveLocationScope: vi.fn<MerchantContextService["resolveLocationScope"]>(),
	};

	async function createService(): Promise<MerchantRewardService> {
		const moduleRef = await Test.createTestingModule({
			providers: [
				MerchantRewardService,
				{ provide: PublicUrlResolver, useValue: createTestPublicUrls() },
				{ provide: RewardRepository, useValue: rewardRepository },
				{ provide: RewardClaimRepository, useValue: {} },
				{ provide: RewardRedemptionRepository, useValue: {} },
				{ provide: MerchantContextService, useValue: merchantContext },
				{ provide: OrganizationRepository, useValue: {} },
				{ provide: RewardNotificationService, useValue: {} },
				{ provide: PlatformOutboxService, useValue: {} },
			],
		}).compile();
		return moduleRef.get(MerchantRewardService);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		merchantContext.requireActorCapability.mockResolvedValue(undefined);
	});

	it("looks the reward up within the caller's store scope and answers 404 when it is not offered there", async () => {
		const scope = selectedLocationsScope([STORE_A]);
		merchantContext.resolveLocationScope.mockResolvedValue(scope);
		rewardRepository.findConsumerByOrganization.mockResolvedValue(null);
		const service = await createService();

		await expect(service.getReward(actor, REWARD_ID)).rejects.toBeInstanceOf(NotFoundException);
		expect(merchantContext.requireActorCapability).toHaveBeenCalledWith(actor, "merchant:view_rewards");
		expect(merchantContext.resolveLocationScope).toHaveBeenCalledWith(actor, undefined);
		expect(rewardRepository.findConsumerByOrganization).toHaveBeenCalledWith(ORGANIZATION_ID, REWARD_ID, scope);
	});
});

describe("MerchantRewardService reward images", () => {
	const COVER_ID = "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e";
	const SECOND_IMAGE_ID = "7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f";
	const REFERRER_ID = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
	const actor = { kind: "user", userId: USER_ID, organizationId: ORGANIZATION_ID, orgSlug: "brew" } satisfies MerchantActor;
	const rewardRepository = {
		findOrgConsumerReward: vi.fn<RewardRepository["findOrgConsumerReward"]>(),
		updateReward: vi.fn<RewardRepository["updateReward"]>(),
		updateRewardWithImages: vi.fn<RewardRepository["updateRewardWithImages"]>(),
		createConsumerReward: vi.fn<RewardRepository["createConsumerReward"]>(),
		countOrganizationLocations: vi.fn<RewardRepository["countOrganizationLocations"]>(),
		findUniqueOrThrowWithOrganization: vi.fn<RewardRepository["findUniqueOrThrowWithOrganization"]>(),
	};
	const merchantContext = {
		requireActorCapability: vi.fn<MerchantContextService["requireActorCapability"]>(),
		resolveLocationScope: vi.fn<MerchantContextService["resolveLocationScope"]>(),
	};

	async function createService(): Promise<MerchantRewardService> {
		const moduleRef = await Test.createTestingModule({
			providers: [
				MerchantRewardService,
				{ provide: PublicUrlResolver, useValue: createTestPublicUrls() },
				{ provide: RewardRepository, useValue: rewardRepository },
				{ provide: RewardClaimRepository, useValue: {} },
				{ provide: RewardRedemptionRepository, useValue: {} },
				{ provide: MerchantContextService, useValue: merchantContext },
				{ provide: OrganizationRepository, useValue: {} },
				{ provide: RewardNotificationService, useValue: {} },
				{ provide: PlatformOutboxService, useValue: {} },
			],
		}).compile();
		return moduleRef.get(MerchantRewardService);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		merchantContext.requireActorCapability.mockResolvedValue(undefined);
		merchantContext.resolveLocationScope.mockResolvedValue(ALL_LOCATIONS_SCOPE);
		rewardRepository.findOrgConsumerReward.mockResolvedValue({
			id: REWARD_ID,
			status: "DRAFT",
			referrerRewardId: REFERRER_ID,
			quantityTotal: 10,
			quantityRemaining: 10,
			locationScopeType: "ALL_LOCATIONS",
			locationIds: [],
		});
		rewardRepository.countOrganizationLocations.mockResolvedValue(1);
	});

	it("replaces the images of the reward and its referrer reward in one checked write, scoped to the caller's organization and recording who changed them", async () => {
		rewardRepository.updateRewardWithImages.mockResolvedValue(undefined);
		rewardRepository.findUniqueOrThrowWithOrganization.mockRejectedValue(new Error("stop after the write"));
		const service = await createService();

		await expect(service.updateReward(actor, REWARD_ID, { imageFileIds: [COVER_ID, SECOND_IMAGE_ID], title: "New title" })).rejects.toThrow("stop after the write");

		expect(rewardRepository.updateRewardWithImages).toHaveBeenCalledWith(
			REWARD_ID,
			REFERRER_ID,
			{ title: "New title" },
			{ organizationId: ORGANIZATION_ID, fileIds: [COVER_ID, SECOND_IMAGE_ID], actorId: USER_ID },
		);
		expect(rewardRepository.updateReward).not.toHaveBeenCalled();
	});

	it("leaves the images alone when an edit does not list them", async () => {
		rewardRepository.updateReward.mockResolvedValue(undefined);
		rewardRepository.findUniqueOrThrowWithOrganization.mockRejectedValue(new Error("stop after the write"));
		const service = await createService();

		await expect(service.updateReward(actor, REWARD_ID, { title: "New title" })).rejects.toThrow("stop after the write");

		expect(rewardRepository.updateReward).toHaveBeenCalledWith(REWARD_ID, { title: "New title" });
		expect(rewardRepository.updateRewardWithImages).not.toHaveBeenCalled();
	});

	it("answers 400 REWARD_IMAGES_INVALID when an image is not one of the organization's ready images — on edit and on create", async () => {
		rewardRepository.updateRewardWithImages.mockRejectedValue(new RewardImagesUnavailableError([COVER_ID]));
		rewardRepository.createConsumerReward.mockRejectedValue(new RewardImagesUnavailableError([COVER_ID]));
		const service = await createService();
		const invalidImages = { response: { error: "REWARD_IMAGES_INVALID" } };

		await expect(service.updateReward(actor, REWARD_ID, { imageFileIds: [COVER_ID] })).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.updateReward(actor, REWARD_ID, { imageFileIds: [COVER_ID] })).rejects.toMatchObject(invalidImages);
		await expect(
			service.createReward(actor, {
				title: "Free kuih",
				description: "One free kuih",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				category: "food",
				imageFileIds: [COVER_ID, SECOND_IMAGE_ID],
				quantityTotal: 10,
				expiryDate: epochMs(1_794_614_400_000),
				referralsEnabled: false,
				saveAsDraft: true,
				locationScopeType: "ALL_LOCATIONS",
				locationIds: [],
			}),
		).rejects.toMatchObject(invalidImages);
		expect(rewardRepository.createConsumerReward).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORGANIZATION_ID }), [COVER_ID, SECOND_IMAGE_ID], []);
	});
});
