import { DEFAULT_TIER_RULES, epochMs, MS_PER_DAY, type EpochMs, type TierRules, type TierSettingsResponse, type UpdateTierSettingsInput } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { systemActor, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { CustomerTierStanding } from "../../domain/aggregates/customer-tier-standing.aggregate";
import type { TierDomainEvent } from "../../domain/events/tier.events";
import type { CountedRedemption } from "../../domain/policies/tier-window.policy";
import { EvaluateCustomerTierCommand } from "../commands/evaluate-customer-tier/evaluate-customer-tier.command";
import { EvaluateCustomerTierHandler } from "../commands/evaluate-customer-tier/evaluate-customer-tier.handler";
import { ReviewCustomerTiersCommand, TIER_REVIEW_PAGE_SIZE, TIER_REVIEW_RECENT_DAYS } from "../commands/review-customer-tiers/review-customer-tiers.command";
import { ReviewCustomerTiersHandler } from "../commands/review-customer-tiers/review-customer-tiers.handler";
import { TierReviewItemsFailedError } from "../errors/tier-review.errors";
import type { TierReviewCandidatesPort } from "../ports/tier-review-candidates.port";
import { TIER_STANDING_EVALUATE_OPERATION } from "../ports/tiers.tokens";
import { TierEvaluator, type TierEvaluationTrigger } from "../services/tier-evaluator";
import { TierSettingsService } from "../services/tier-settings.service";
import type { TiersScope } from "../tiers-scope";
import { FixedTierSettings, StoppedClock, SwitchableTiersAvailability } from "./fakes/tier-reads.fakes";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const CUSTOMER = "0193f2c4-0000-7000-8000-0000000000a1";
const CAFE = "0193f2c4-0000-7000-8000-00000000c001";
const BAKERY = "0193f2c4-0000-7000-8000-00000000c002";
const ACTOR: ActorContext = systemActor(TIER_STANDING_EVALUATE_OPERATION, "cron", null, "Nightly tier review", null);

function redeemed(count: number, daysAgo: number): CountedRedemption[] {
	return Array.from({ length: count }, (): CountedRedemption => ({ tenantId: CAFE, redeemedAt: epochMs(NOW - daysAgo * MS_PER_DAY) }));
}

/** One customer's tier transaction over plain values: their standing, their redemptions, the notices sent. */
class InMemoryTiersUnitOfWork implements UnitOfWork<TiersScope> {
	public standing: CustomerTierStanding = CustomerTierStanding.fresh(CUSTOMER);
	public redemptions: readonly CountedRedemption[] = [];
	public rules: TierRules = DEFAULT_TIER_RULES;
	public readonly notices: TierDomainEvent[] = [];
	public readonly operations: SystemOperationName[] = [];
	public sinceAsked: EpochMs | null = null;
	public saved = 0;

	public run<TResult>(_actor: ActorContext, work: (scope: TiersScope) => Promise<TResult>): Promise<TResult> {
		return work(this.scope());
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, _actor: ActorContext, work: (scope: TiersScope) => Promise<TResult>): Promise<TResult> {
		this.operations.push(operation);
		return work(this.scope());
	}

	private scope(): TiersScope {
		return {
			standings: {
				lockForEvaluation: (): Promise<CustomerTierStanding> => Promise.resolve(this.standing),
				save: (): Promise<void> => {
					this.saved += 1;
					return Promise.resolve();
				},
			},
			redemptions: {
				countedSince: (_userId: string, since: EpochMs): Promise<readonly CountedRedemption[]> => {
					this.sinceAsked = since;
					return Promise.resolve(this.redemptions.filter((redemption) => redemption.redeemedAt > since));
				},
			},
			rules: { current: (): Promise<TierRules> => Promise.resolve(this.rules) },
			notices: {
				send: (event: TierDomainEvent): Promise<void> => {
					this.notices.push(event);
					return Promise.resolve();
				},
			},
		};
	}
}

describe("TierEvaluator", () => {
	let uow: InMemoryTiersUnitOfWork;
	let evaluator: TierEvaluator;

	beforeEach(() => {
		uow = new InMemoryTiersUnitOfWork();
		evaluator = new TierEvaluator(uow, new StoppedClock(NOW));
	});

	it("promotes after a redemption, saves, and sends the promotion's notice — all under the evaluate operation", async () => {
		uow.redemptions = redeemed(DEFAULT_TIER_RULES.silverThreshold, 1);

		await expect(evaluator.evaluate(ACTOR, CUSTOMER, "redemption")).resolves.toBe("SILVER");
		expect(uow.operations).toStrictEqual([TIER_STANDING_EVALUATE_OPERATION]);
		expect(uow.saved).toBe(1);
		expect(uow.notices.map((event) => event.eventName)).toStrictEqual(["tiers.CustomerTierPromoted"]);
	});

	it("reads only the redemptions inside the window", async () => {
		uow.redemptions = [...redeemed(DEFAULT_TIER_RULES.silverThreshold, DEFAULT_TIER_RULES.windowDays + 1)];

		await expect(evaluator.evaluate(ACTOR, CUSTOMER, "redemption")).resolves.toBe("BRONZE");
		expect(uow.sinceAsked).toBe(epochMs(NOW - DEFAULT_TIER_RULES.windowDays * MS_PER_DAY));
		expect(uow.notices).toStrictEqual([]);
	});

	it("applies the review's rule for the nightly trigger, and the same promotion (two merchants, under the cap)", async () => {
		const atBakery = DEFAULT_TIER_RULES.goldThreshold - DEFAULT_TIER_RULES.perMerchantCap;
		uow.redemptions = [
			...redeemed(DEFAULT_TIER_RULES.perMerchantCap, 1),
			...Array.from({ length: atBakery }, (): CountedRedemption => ({ tenantId: BAKERY, redeemedAt: epochMs(NOW - MS_PER_DAY) })),
		];
		const trigger: TierEvaluationTrigger = "review";

		await expect(evaluator.evaluate(ACTOR, CUSTOMER, trigger)).resolves.toBe("GOLD");
		expect(uow.saved).toBe(1);
	});
});

describe("EvaluateCustomerTierHandler", () => {
	it("evaluates after a redemption while tiers are on, and does nothing while they are off", async () => {
		const availability = new SwitchableTiersAvailability();
		const evaluate = vi.fn<TierEvaluator["evaluate"]>(() => Promise.resolve("SILVER"));
		const handler = new EvaluateCustomerTierHandler(availability, { evaluate });

		await expect(handler.execute(new EvaluateCustomerTierCommand(ACTOR, CUSTOMER))).resolves.toBe("SILVER");
		expect(evaluate).toHaveBeenCalledWith(ACTOR, CUSTOMER, "redemption");

		availability.on = false;
		await expect(handler.execute(new EvaluateCustomerTierCommand(ACTOR, CUSTOMER))).resolves.toBeNull();
		expect(evaluate).toHaveBeenCalledTimes(1);
	});
});

describe("ReviewCustomerTiersHandler", () => {
	const SECOND = "0193f2c4-0000-7000-8000-0000000000a2";
	const THIRD = "0193f2c4-0000-7000-8000-0000000000a3";

	function candidatesOf(pages: readonly (readonly string[])[]): TierReviewCandidatesPort & { readonly asked: (string | null)[] } {
		const asked: (string | null)[] = [];
		return {
			asked,
			page: (afterUserId: string | null, limit: number, recentSince: EpochMs): Promise<readonly string[]> => {
				expect(limit).toBe(TIER_REVIEW_PAGE_SIZE);
				expect(recentSince).toBe(epochMs(NOW - TIER_REVIEW_RECENT_DAYS * MS_PER_DAY));
				asked.push(afterUserId);
				return Promise.resolve(pages.at(asked.length - 1) ?? []);
			},
		};
	}

	it("reviews every page of candidates, each on its own, until none are left", async () => {
		const candidates = candidatesOf([[CUSTOMER, SECOND], [THIRD]]);
		const evaluate = vi.fn<TierEvaluator["evaluate"]>(() => Promise.resolve("BRONZE"));
		const handler = new ReviewCustomerTiersHandler(new SwitchableTiersAvailability(), candidates, { evaluate }, new StoppedClock(NOW));

		await expect(handler.execute(new ReviewCustomerTiersCommand(ACTOR))).resolves.toStrictEqual({ reviewed: 3, failed: 0 });
		expect(candidates.asked).toStrictEqual([null, SECOND, THIRD]);
		expect(evaluate.mock.calls.map(([, userId, trigger]) => [userId, trigger])).toStrictEqual([
			[CUSTOMER, "review"],
			[SECOND, "review"],
			[THIRD, "review"],
		]);
	});

	it("keeps going past one customer's failure, then fails the run so it is audited", async () => {
		const failure = new Error("lock timeout");
		const evaluate = vi.fn<TierEvaluator["evaluate"]>((_actor, userId) => (userId === SECOND ? Promise.reject(failure) : Promise.resolve("BRONZE")));
		const handler = new ReviewCustomerTiersHandler(new SwitchableTiersAvailability(), candidatesOf([[CUSTOMER, SECOND, THIRD]]), { evaluate }, new StoppedClock(NOW));

		const run = handler.execute(new ReviewCustomerTiersCommand(ACTOR));
		await expect(run).rejects.toBeInstanceOf(TierReviewItemsFailedError);
		await expect(run).rejects.toMatchObject({ failed: 1, firstFailure: failure });
		expect(evaluate).toHaveBeenCalledTimes(3);
	});

	it("does nothing while tiers are off", async () => {
		const availability = new SwitchableTiersAvailability();
		availability.on = false;
		const candidates = candidatesOf([[CUSTOMER]]);
		const handler = new ReviewCustomerTiersHandler(availability, candidates, { evaluate: vi.fn() }, new StoppedClock(NOW));

		await expect(handler.execute(new ReviewCustomerTiersCommand(ACTOR))).resolves.toStrictEqual({ reviewed: 0, failed: 0 });
		expect(candidates.asked).toStrictEqual([]);
	});
});

describe("TierSettingsService", () => {
	it("reads the rules, and saves a change stamped with the clock's time", async () => {
		const store = new FixedTierSettings();
		const save = vi.spyOn(store, "save");
		const service = new TierSettingsService(store, new StoppedClock(NOW));
		const input: UpdateTierSettingsInput = { ...DEFAULT_TIER_RULES, goldThreshold: 30, reason: "Gold was too easy in the pilot" };

		const read: TierSettingsResponse = await service.settings(ACTOR);
		expect(read).toMatchObject(DEFAULT_TIER_RULES);
		await service.update(ACTOR, input);
		expect(save).toHaveBeenCalledWith(ACTOR, input, NOW);
	});
});
