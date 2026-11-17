import { describe, expect, it } from "vitest";

import type { CustomerTierAccess } from "../../../../platform/domain/customer-tier-access";
import { Reward } from "../aggregates/reward.aggregate";
import { RewardAudienceInvalidError, RewardAudienceReferralsError, RewardMinimumTierInvalidError, RewardNotFoundError, RewardTierLockedError } from "../errors/reward.errors";
import { RewardRevised } from "../events/reward.events";
import { decideRewardAudience } from "../policies/reward-audience.policy";
import { RewardAudience } from "../value-objects/reward-audience.value-object";
import { CUSTOMER_ID, newReward, NOW, rewardState, TIERS_OFF } from "./reward-state.fixture";

const OTHER_CUSTOMER = "55555555-5555-4555-8555-555555555555";
const MANAGER = { actorId: "merchant-1", locationIds: null };
const SILVER: CustomerTierAccess = { kind: "on", tier: "SILVER" };
const GOLD: CustomerTierAccess = { kind: "on", tier: "GOLD" };
const DIAMOND: CustomerTierAccess = { kind: "on", tier: "DIAMOND" };

describe("RewardAudience", () => {
	it("lets everyone in, signed in or not, when it is for everyone", () => {
		expect(RewardAudience.everyone().includes(null)).toBe(true);
		expect(RewardAudience.everyone().includes(CUSTOMER_ID)).toBe(true);
	});

	it("lets only the chosen customers in, each once", () => {
		const audience = RewardAudience.selected([CUSTOMER_ID, CUSTOMER_ID]);

		expect(audience.customerIds).toEqual([CUSTOMER_ID]);
		expect(audience.includes(CUSTOMER_ID)).toBe(true);
		expect(audience.includes(OTHER_CUSTOMER)).toBe(false);
		expect(audience.includes(null)).toBe(false);
	});

	it("compares by type, minimum tier and customers in order", () => {
		expect(RewardAudience.selected([CUSTOMER_ID]).equals(RewardAudience.fromStorage("SELECTED_CUSTOMERS", [CUSTOMER_ID], "BRONZE"))).toBe(true);
		expect(RewardAudience.fromStorage("EVERYONE", [CUSTOMER_ID], "BRONZE").equals(RewardAudience.everyone())).toBe(true);
		expect(RewardAudience.selected([CUSTOMER_ID]).equals(RewardAudience.selected([OTHER_CUSTOMER]))).toBe(false);
		expect(RewardAudience.everyone("GOLD").equals(RewardAudience.everyone())).toBe(false);
	});
});

describe("a reward's minimum tier (ADR 085)", () => {
	it("is open to its own tier and every higher one, and to everyone while tiers are off", () => {
		const gold = RewardAudience.everyone("GOLD");

		expect(gold.isOpenTo(GOLD)).toBe(true);
		expect(gold.isOpenTo(DIAMOND)).toBe(true);
		expect(gold.isOpenTo(SILVER)).toBe(false);
		expect(gold.isOpenTo(TIERS_OFF)).toBe(true);
		expect(gold.narrowsByTier).toBe(true);
		expect(RewardAudience.everyone().narrowsByTier).toBe(false);
	});

	it("is still seen by everyone below it: a locked reward is shown, only not claimable", () => {
		expect(RewardAudience.everyone("DIAMOND").includes(null)).toBe(true);
	});

	it("is refused above Bronze for chosen customers, who are open at any tier", () => {
		expect(() => RewardAudience.selected([CUSTOMER_ID]).withMinimumTier("SILVER")).toThrow(RewardMinimumTierInvalidError);
		expect(RewardAudience.selected([CUSTOMER_ID]).withMinimumTier("BRONZE").minimumTier).toBe("BRONZE");
	});

	it("refuses a claim, a hold and a reservation below the minimum tier with 403-locked, never as not found", () => {
		const gold = (): Reward => Reward.rehydrate(rewardState("PUBLISHED", { audience: RewardAudience.everyone("GOLD") }));

		expect(() => gold().assertClaimable(NOW, CUSTOMER_ID, SILVER)).toThrow(RewardTierLockedError);
		expect(() => {
			gold().holdUnit(NOW, CUSTOMER_ID, SILVER);
		}).toThrow(RewardTierLockedError);
		expect(() => gold().reserve(NOW, CUSTOMER_ID, SILVER)).toThrow(RewardTierLockedError);
		expect(gold().assertClaimable(NOW, CUSTOMER_ID, GOLD).rewardId).toBeDefined();
		expect(gold().reserve(NOW, CUSTOMER_ID, TIERS_OFF).rewardId).toBeDefined();
	});

	it("cannot be set with referrals, on create or on a later change", () => {
		expect(() => Reward.create(newReward({ audience: RewardAudience.everyone("GOLD"), referralsEnabled: true, referralPoolTotal: 3 }), NOW)).toThrow(
			RewardMinimumTierInvalidError,
		);
		const referred = Reward.rehydrate(rewardState("PUBLISHED", { referralsEnabled: true }));
		expect(() => {
			referred.changeMinimumTier("GOLD", MANAGER, NOW);
		}).toThrow(RewardMinimumTierInvalidError);
	});

	it("changes on a published reward without another review, recording the edit", () => {
		const reward = Reward.rehydrate(rewardState("PUBLISHED"));

		reward.changeMinimumTier("GOLD", MANAGER, NOW);

		expect(reward.snapshot().audience.minimumTier).toBe("GOLD");
		expect(reward.snapshot().review.status).toBe("PUBLISHED");
		expect(reward.hasDefinitionChanges).toBe(true);
		expect(reward.pullEvents().map((event) => event.constructor)).toEqual([RewardRevised]);
	});

	it("does nothing when the tier is already the reward's", () => {
		const reward = Reward.rehydrate(rewardState("PUBLISHED", { audience: RewardAudience.everyone("GOLD") }));

		reward.changeMinimumTier("GOLD", MANAGER, NOW);

		expect(reward.hasDefinitionChanges).toBe(false);
		expect(reward.pullEvents()).toEqual([]);
	});

	it.each(["DRAFT", "PENDING_REVIEW"])("changes on a %s reward too", (status) => {
		const reward = Reward.rehydrate(rewardState(status));
		reward.changeMinimumTier("SILVER", MANAGER, NOW);
		expect(reward.snapshot().audience.minimumTier).toBe("SILVER");
	});

	it("is not found outside the caller's stores", () => {
		const reward = Reward.rehydrate(rewardState("PUBLISHED"));
		expect(() => {
			reward.changeMinimumTier("GOLD", { actorId: "merchant-2", locationIds: [] }, NOW);
		}).toThrow(RewardNotFoundError);
	});

	it("keeps the minimum tier of a reward still for everyone when an edit leaves it out, and resets it for chosen customers", () => {
		const draft = Reward.rehydrate(rewardState("DRAFT", { audience: RewardAudience.everyone("SILVER") }));
		draft.revise({ audience: RewardAudience.everyone(), title: "Renamed" }, MANAGER, NOW);
		expect(draft.snapshot().audience.minimumTier).toBe("SILVER");

		draft.revise({ audience: RewardAudience.selected([CUSTOMER_ID]) }, MANAGER, NOW);
		expect(draft.snapshot().audience.minimumTier).toBe("BRONZE");
	});

	it("takes a minimum tier sent with an edit, and refuses it with chosen customers", () => {
		const draft = Reward.rehydrate(rewardState("DRAFT"));
		draft.revise({ minimumTier: "DIAMOND" }, MANAGER, NOW);
		expect(draft.snapshot().audience.minimumTier).toBe("DIAMOND");

		expect(() => {
			draft.revise({ audience: RewardAudience.selected([CUSTOMER_ID]), minimumTier: "GOLD" }, MANAGER, NOW);
		}).toThrow(RewardMinimumTierInvalidError);
	});
});

describe("decideRewardAudience", () => {
	it("is everyone when nothing is chosen", () => {
		expect(decideRewardAudience({ audienceType: "EVERYONE", customerIds: [] }, []).isEveryone).toBe(true);
	});

	it("takes customers of the tenant, and refuses anyone else or no one", () => {
		expect(decideRewardAudience({ audienceType: "SELECTED_CUSTOMERS", customerIds: [CUSTOMER_ID] }, [CUSTOMER_ID]).customerIds).toEqual([CUSTOMER_ID]);
		expect(() => decideRewardAudience({ audienceType: "SELECTED_CUSTOMERS", customerIds: [CUSTOMER_ID, OTHER_CUSTOMER] }, [CUSTOMER_ID])).toThrow(RewardAudienceInvalidError);
		expect(() => decideRewardAudience({ audienceType: "SELECTED_CUSTOMERS", customerIds: [] }, [])).toThrow(RewardAudienceInvalidError);
	});
});

describe("a reward for chosen customers", () => {
	const forCustomer = (): Reward => Reward.rehydrate(rewardState("PUBLISHED", { audience: RewardAudience.selected([CUSTOMER_ID]) }));

	it("can be claimed and reserved only by them; to anyone else it does not exist", () => {
		expect(forCustomer().assertClaimable(NOW, CUSTOMER_ID, TIERS_OFF).rewardId).toBeDefined();
		expect(() => forCustomer().assertClaimable(NOW, OTHER_CUSTOMER, TIERS_OFF)).toThrow(RewardNotFoundError);
		expect(() => forCustomer().reserve(NOW, OTHER_CUSTOMER, TIERS_OFF)).toThrow(RewardNotFoundError);
		expect(forCustomer().reserve(NOW, CUSTOMER_ID, TIERS_OFF).rewardId).toBeDefined();
	});

	it("is open to its customers at any tier", () => {
		expect(forCustomer().assertClaimable(NOW, CUSTOMER_ID, { kind: "on", tier: "BRONZE" }).rewardId).toBeDefined();
	});

	it("cannot be created, or later revised, with referrals", () => {
		expect(() => Reward.create(newReward({ audience: RewardAudience.selected([CUSTOMER_ID]), referralsEnabled: true, referralPoolTotal: 3 }), NOW)).toThrow(
			RewardAudienceReferralsError,
		);

		const draft = Reward.rehydrate(rewardState("DRAFT", { audience: RewardAudience.selected([CUSTOMER_ID]) }));
		expect(() => {
			draft.revise({ referralsEnabled: true }, MANAGER, NOW);
		}).toThrow(RewardAudienceReferralsError);
	});

	it("records a changed audience for the repository, and an unchanged one not at all", () => {
		const draft = Reward.rehydrate(rewardState("DRAFT"));
		draft.revise({ audience: RewardAudience.everyone() }, MANAGER, NOW);
		expect(draft.audienceReplacedBy).toBeNull();

		draft.revise({ audience: RewardAudience.selected([CUSTOMER_ID]) }, MANAGER, NOW);
		expect(draft.audienceReplacedBy).toEqual({ actorId: MANAGER.actorId, at: NOW });
		expect(draft.snapshot().audience.customerIds).toEqual([CUSTOMER_ID]);
	});
});
