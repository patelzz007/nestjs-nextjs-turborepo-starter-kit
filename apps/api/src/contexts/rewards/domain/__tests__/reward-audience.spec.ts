import { describe, expect, it } from "vitest";

import { Reward } from "../aggregates/reward.aggregate";
import { RewardAudienceInvalidError, RewardAudienceReferralsError, RewardNotFoundError } from "../errors/reward.errors";
import { decideRewardAudience } from "../policies/reward-audience.policy";
import { RewardAudience } from "../value-objects/reward-audience.value-object";
import { CUSTOMER_ID, newReward, NOW, rewardState } from "./reward-state.fixture";

const OTHER_CUSTOMER = "55555555-5555-4555-8555-555555555555";
const MANAGER = { actorId: "merchant-1", locationIds: null };

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

	it("compares by type and customers in order", () => {
		expect(RewardAudience.selected([CUSTOMER_ID]).equals(RewardAudience.fromStorage("SELECTED_CUSTOMERS", [CUSTOMER_ID]))).toBe(true);
		expect(RewardAudience.fromStorage("EVERYONE", [CUSTOMER_ID]).equals(RewardAudience.everyone())).toBe(true);
		expect(RewardAudience.selected([CUSTOMER_ID]).equals(RewardAudience.selected([OTHER_CUSTOMER]))).toBe(false);
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
		expect(forCustomer().assertClaimable(NOW, CUSTOMER_ID).rewardId).toBeDefined();
		expect(() => forCustomer().assertClaimable(NOW, OTHER_CUSTOMER)).toThrow(RewardNotFoundError);
		expect(() => forCustomer().reserve(NOW, OTHER_CUSTOMER)).toThrow(RewardNotFoundError);
		expect(forCustomer().reserve(NOW, CUSTOMER_ID).rewardId).toBeDefined();
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
