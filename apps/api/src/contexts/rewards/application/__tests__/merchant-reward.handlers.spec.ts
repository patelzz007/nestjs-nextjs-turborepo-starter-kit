import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { FakeMerchantAccessPort } from "../../../../platform/application/__tests__/fakes/fake-merchant-access.port";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { ConflictError } from "../../../../platform/application/errors/app-error";
import { AuthorizationDeniedError } from "../../../../platform/domain/errors/authorization-denied.error";
import {
	RewardImagesInvalidError,
	RewardLocationForbiddenError,
	RewardLocationInvalidError,
	RewardNotDraftError,
	RewardNotEditableError,
	RewardNotFoundError,
} from "../../domain/errors/reward.errors";
import { RewardLocationScope } from "../../domain/value-objects/reward-location-scope.value-object";
import { NOW, ORGANIZATION_ID, REWARD_ID, referrerRow, rewardState, STORE_A, STORE_B } from "../../domain/__tests__/reward-state.fixture";
import { CreateRewardCommand, type CreateRewardInput } from "../commands/create-reward/create-reward.command";
import { CreateRewardHandler } from "../commands/create-reward/create-reward.handler";
import { ReviseRewardCommand } from "../commands/revise-reward/revise-reward.command";
import { ReviseRewardHandler } from "../commands/revise-reward/revise-reward.handler";
import { SubmitRewardForReviewCommand } from "../commands/submit-reward-for-review/submit-reward-for-review.command";
import { SubmitRewardForReviewHandler } from "../commands/submit-reward-for-review/submit-reward-for-review.handler";
import type { RewardsScope } from "../rewards-scope";
import { fakeRewardsScope, SequentialIds, type FakeRewardsScope } from "./fakes/rewards-scope.fakes";
import { apiKeyActor, API_KEY_ID, MERCHANT_USER_ID, userActor } from "./reward-test-actors";

const IMAGE_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_ORGANIZATION_ID = "99999999-9999-4999-8999-999999999999";

function createInput(patch: Partial<CreateRewardInput> = {}): CreateRewardInput {
	return {
		organizationId: ORGANIZATION_ID,
		title: "Free coffee",
		description: "One free coffee",
		rewardType: "FREE_ITEM",
		rewardValue: 0,
		category: "cafe",
		imageFileIds: [IMAGE_ID],
		quantityTotal: 5,
		expiryDate: NOW,
		referralsEnabled: false,
		saveAsDraft: true,
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		...patch,
	};
}

interface Harness {
	readonly scope: FakeRewardsScope;
	readonly uow: InMemoryUnitOfWork<RewardsScope>;
	readonly access: FakeMerchantAccessPort;
	readonly clock: FixedClock;
}

function harness(activeStores: readonly string[] = []): Harness {
	const scope = fakeRewardsScope(activeStores);
	scope.imageFiles.usable.add(IMAGE_ID);
	return { scope, uow: new InMemoryUnitOfWork<RewardsScope>(scope), access: new FakeMerchantAccessPort(), clock: new FixedClock(NOW) };
}

describe("CreateRewardHandler (D02)", () => {
	it("creates the reward through the unit of work as the caller, locking its images, and returns its view", async () => {
		const h = harness();
		const handler = new CreateRewardHandler(h.uow, h.access, new SequentialIds(), h.clock);
		const actor = userActor();

		const response = await handler.execute(new CreateRewardCommand(actor, createInput()));

		expect(h.scope.rewards.added).toHaveLength(1);
		expect(response.title).toBe("Free coffee");
		expect(h.scope.imageFiles.locks).toEqual([{ organizationId: ORGANIZATION_ID, fileIds: [IMAGE_ID] }]);
		expect(h.access.requests.at(0)?.request).toEqual({ organizationId: ORGANIZATION_ID, capability: "merchant:manage_rewards" });
		expect(h.uow.committed).toEqual([{ actor, operation: null }]);
		expect(h.scope.events.recordedNames()).toEqual(["rewards.RewardCreated"]);
	});

	it("creates the referrer child in the same aggregate when referrals are on", async () => {
		const h = harness();
		await new CreateRewardHandler(h.uow, h.access, new SequentialIds(), h.clock).execute(
			new CreateRewardCommand(userActor(), createInput({ referralsEnabled: true, referralPoolTotal: 3 })),
		);
		const [rewardId] = h.scope.rewards.added;
		expect(h.scope.rewards.rows.get(rewardId ?? "")?.referrer?.inventory.quantityTotal).toBe(3);
	});

	it("writes nothing when the caller may not manage rewards", async () => {
		const h = harness();
		h.access.deny("merchant:manage_rewards");
		await expect(new CreateRewardHandler(h.uow, h.access, new SequentialIds(), h.clock).execute(new CreateRewardCommand(userActor(), createInput()))).rejects.toThrow(
			AuthorizationDeniedError,
		);
		expect(h.scope.rewards.added).toEqual([]);
		expect(h.uow.committed).toEqual([]);
	});

	it("rolls back on an image that is not one of the organization's ready reward images", async () => {
		const h = harness();
		await expect(
			new CreateRewardHandler(h.uow, h.access, new SequentialIds(), h.clock).execute(
				new CreateRewardCommand(userActor(), createInput({ imageFileIds: ["77777777-7777-4777-8777-777777777777"] })),
			),
		).rejects.toThrow(RewardImagesInvalidError);
		expect(h.scope.rewards.added).toEqual([]);
		expect(h.uow.rolledBack).toHaveLength(1);
	});

	it("refuses a store-limited merchant an organization-wide reward, and an inactive store to anyone", async () => {
		const limited = harness([STORE_A, STORE_B]);
		limited.access.grantLocations([STORE_A]);
		await expect(
			new CreateRewardHandler(limited.uow, limited.access, new SequentialIds(), limited.clock).execute(new CreateRewardCommand(userActor(), createInput())),
		).rejects.toThrow(RewardLocationForbiddenError);

		const all = harness([STORE_A, STORE_B]);
		await expect(
			new CreateRewardHandler(all.uow, all.access, new SequentialIds(), all.clock).execute(
				new CreateRewardCommand(userActor(), createInput({ locationScopeType: "SELECTED", locationIds: [STORE_A, "77777777-7777-4777-8777-777777777777"] })),
			),
		).rejects.toThrow(RewardLocationInvalidError);
		expect(all.scope.rewards.added).toEqual([]);
	});
});

describe("ReviseRewardHandler (D03)", () => {
	it("saves the edit with a compare-and-set, the referrer child included, recording who replaced the images", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("DRAFT", { referrer: referrerRow("DRAFT") }));
		await new ReviseRewardHandler(h.uow, h.access, h.clock).execute(
			new ReviseRewardCommand(userActor(), {
				organizationId: ORGANIZATION_ID,
				rewardId: REWARD_ID,
				title: "Two coffees",
				referrerRewardTitle: "Bring a friend",
				imageFileIds: [IMAGE_ID],
			}),
		);
		const stored = h.scope.rewards.rows.get(REWARD_ID);
		expect(stored?.title).toBe("Two coffees");
		expect(stored?.referrer?.title).toBe("Bring a friend");
		expect(h.scope.imageFiles.locks).toHaveLength(1);
		expect(h.scope.rewards.imageReplacements).toEqual([{ actorId: MERCHANT_USER_ID, at: NOW }]);
		expect(h.scope.events.recordedNames()).toEqual(["rewards.RewardRevised"]);
	});

	it("records the API key as the editor for a machine call", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("DRAFT"));
		await new ReviseRewardHandler(h.uow, h.access, h.clock).execute(
			new ReviseRewardCommand(apiKeyActor(ORGANIZATION_ID), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID, imageFileIds: [IMAGE_ID] }),
		);
		expect(h.scope.rewards.imageReplacements).toEqual([{ actorId: API_KEY_ID, at: NOW }]);
	});

	it("does not lock images when the edit leaves them alone", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("DRAFT"));
		await new ReviseRewardHandler(h.uow, h.access, h.clock).execute(
			new ReviseRewardCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID, title: "x" }),
		);
		expect(h.scope.imageFiles.locks).toEqual([]);
	});

	it("answers 404 for another organization's reward and for one outside the caller's stores", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("DRAFT", { organizationId: OTHER_ORGANIZATION_ID }));
		await expect(
			new ReviseRewardHandler(h.uow, h.access, h.clock).execute(new ReviseRewardCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID, title: "x" })),
		).rejects.toThrow(RewardNotFoundError);

		const limited = harness();
		limited.access.grantLocations([STORE_A]);
		limited.scope.rewards.seed(rewardState("DRAFT", { locationScope: RewardLocationScope.selected([STORE_B]) }));
		await expect(
			new ReviseRewardHandler(limited.uow, limited.access, limited.clock).execute(
				new ReviseRewardCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID, title: "x" }),
			),
		).rejects.toThrow(RewardNotFoundError);
		expect(limited.scope.rewards.saved).toEqual([]);
	});

	it("refuses a published reward and rolls back", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("PUBLISHED"));
		await expect(
			new ReviseRewardHandler(h.uow, h.access, h.clock).execute(new ReviseRewardCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID, title: "x" })),
		).rejects.toThrow(RewardNotEditableError);
		expect(h.uow.rolledBack).toHaveLength(1);
	});

	it("propagates a lost compare-and-set (a concurrent review decision won)", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("PENDING_REVIEW")).forceConflictOnNextSave();
		await expect(
			new ReviseRewardHandler(h.uow, h.access, h.clock).execute(new ReviseRewardCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID, title: "x" })),
		).rejects.toThrow(ConflictError);
		expect(h.scope.rewards.rows.get(REWARD_ID)?.title).toBe("Free coffee");
	});
});

describe("SubmitRewardForReviewHandler (D04)", () => {
	it("submits the reward and its child together", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("DRAFT", { referrer: referrerRow("DRAFT") }));
		const response = await new SubmitRewardForReviewHandler(h.uow, h.access, h.clock).execute(
			new SubmitRewardForReviewCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID }),
		);
		expect(response.status).toBe("PENDING_REVIEW");
		expect(h.scope.rewards.rows.get(REWARD_ID)?.referrer?.status).toBe("PENDING_REVIEW");
	});

	it("refuses a reward that is no longer a draft (the loser of a double submit)", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("PENDING_REVIEW"));
		await expect(
			new SubmitRewardForReviewHandler(h.uow, h.access, h.clock).execute(
				new SubmitRewardForReviewCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID }),
			),
		).rejects.toThrow(RewardNotDraftError);
	});

	it("propagates a lost compare-and-set", async () => {
		const h = harness();
		h.scope.rewards.seed(rewardState("DRAFT")).forceConflictOnNextSave();
		await expect(
			new SubmitRewardForReviewHandler(h.uow, h.access, h.clock).execute(
				new SubmitRewardForReviewCommand(userActor(), { organizationId: ORGANIZATION_ID, rewardId: REWARD_ID }),
			),
		).rejects.toThrow(ConflictError);
	});
});
