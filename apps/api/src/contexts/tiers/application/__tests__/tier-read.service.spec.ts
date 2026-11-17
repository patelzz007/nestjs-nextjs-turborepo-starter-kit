import { DEFAULT_TIER_RULES, epochMs, MS_PER_DAY, type CustomerTierChange, type EpochMs } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { TiersDisabledError } from "../../domain/errors/tier.errors";
import type { CountedRedemption } from "../../domain/policies/tier-window.policy";
import { TierAccessService } from "../services/tier-access.service";
import { TIER_HISTORY_LIMIT, TierReadService } from "../services/tier-read.service";
import { FixedTierSettings, InMemoryTierReads, StoppedClock, SwitchableTiersAvailability } from "./fakes/tier-reads.fakes";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const CUSTOMER = "0193f2c4-0000-7000-8000-0000000000a1";
const NEWCOMER = "0193f2c4-0000-7000-8000-0000000000a2";
const CAFE = "0193f2c4-0000-7000-8000-00000000c001";
const BAKERY = "0193f2c4-0000-7000-8000-00000000c002";
const REQUEST = { requestId: "req-tiers", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
/** Days before now the customer's redemptions were made — well inside the window. */
const DAYS_AGO = 10;

function signedIn(userId: string): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

const SIGNED_OUT: ActorContext = { kind: "anonymous", tenantId: null, request: REQUEST };

function redeemed(tenantId: string, count: number): CountedRedemption[] {
	return Array.from({ length: count }, (): CountedRedemption => ({ tenantId, redeemedAt: epochMs(NOW - DAYS_AGO * MS_PER_DAY) }));
}

describe("TierReadService", () => {
	let reads: InMemoryTierReads;
	let availability: SwitchableTiersAvailability;
	let service: TierReadService;

	beforeEach(() => {
		reads = new InMemoryTierReads();
		availability = new SwitchableTiersAvailability();
		service = new TierReadService(reads, new FixedTierSettings(), availability, new StoppedClock(NOW));
		reads.standings.set(CUSTOMER, { tier: "SILVER", countedRedemptions: 12, holdUntil: null, warning: null, evaluatedAt: NOW });
	});

	describe("availability", () => {
		it("says tiers are off, with no tier, while the flag is off", async () => {
			availability.on = false;
			await expect(service.availability(signedIn(CUSTOMER))).resolves.toStrictEqual({ enabled: false });
		});

		it("names a signed-out visitor Bronze", async () => {
			await expect(service.availability(SIGNED_OUT)).resolves.toStrictEqual({ enabled: true, viewerTier: "BRONZE" });
		});

		it("names a signed-in customer's stored tier, and Bronze before their first evaluation", async () => {
			await expect(service.availability(signedIn(CUSTOMER))).resolves.toStrictEqual({ enabled: true, viewerTier: "SILVER" });
			await expect(service.availability(signedIn(NEWCOMER))).resolves.toStrictEqual({ enabled: true, viewerTier: "BRONZE" });
		});
	});

	describe("myTier", () => {
		it("is refused while tiers are off, and to a signed-out caller", async () => {
			await expect(service.myTier(SIGNED_OUT)).rejects.toBeInstanceOf(TiersDisabledError);
			availability.on = false;
			await expect(service.myTier(signedIn(CUSTOMER))).rejects.toBeInstanceOf(TiersDisabledError);
		});

		it("shows the tier, the redemptions to the next one, and each merchant's counted redemptions under the cap", async () => {
			reads.redemptions.set(CUSTOMER, [...redeemed(CAFE, 22), ...redeemed(BAKERY, 2)]);
			reads.names.set(CAFE, "Cafe");
			const page = await service.myTier(signedIn(CUSTOMER));
			expect(page).toMatchObject({ tier: "SILVER", countedRedemptions: 22, nextTier: "GOLD", redemptionsToNextTier: 3, holdUntil: null, demotionWarning: null });
			expect(page.merchants).toStrictEqual([
				{ tenantId: CAFE, counted: DEFAULT_TIER_RULES.perMerchantCap, remainingUnderCap: 0, tenantName: "Cafe" },
				{ tenantId: BAKERY, counted: 2, remainingUnderCap: DEFAULT_TIER_RULES.perMerchantCap - 2, tenantName: "" },
			]);
			expect(reads.countedSinceAsked).toStrictEqual([epochMs(NOW - DEFAULT_TIER_RULES.windowDays * MS_PER_DAY)]);
		});

		it("keeps a hold still ahead, drops one that has passed, and says how many redemptions keep a warned tier", async () => {
			const holdUntil = epochMs(NOW + MS_PER_DAY);
			const dueAt = epochMs(NOW + DAYS_AGO * MS_PER_DAY);
			reads.standings.set(CUSTOMER, { tier: "SILVER", countedRedemptions: 4, holdUntil, warning: { toTier: "BRONZE", dueAt }, evaluatedAt: NOW });
			reads.redemptions.set(CUSTOMER, redeemed(CAFE, 4));
			const page = await service.myTier(signedIn(CUSTOMER));
			expect(page.holdUntil).toBe(holdUntil);
			expect(page.demotionWarning).toStrictEqual({ toTier: "BRONZE", dueAt, redemptionsToKeep: DEFAULT_TIER_RULES.silverThreshold - 4 });
			reads.standings.set(CUSTOMER, { tier: "SILVER", countedRedemptions: 4, holdUntil: epochMs(NOW - 1), warning: null, evaluatedAt: NOW });
			expect((await service.myTier(signedIn(CUSTOMER))).holdUntil).toBeNull();
		});

		it("shows a never-evaluated customer as Bronze with the whole way to Silver ahead", async () => {
			const page = await service.myTier(signedIn(NEWCOMER));
			expect(page).toMatchObject({ tier: "BRONZE", countedRedemptions: 0, nextTier: "SILVER", redemptionsToNextTier: DEFAULT_TIER_RULES.silverThreshold });
		});
	});

	describe("userTier", () => {
		it("shows platform staff a customer's tier and at most the history limit", async () => {
			const change: CustomerTierChange = {
				id: "0193f2c4-0000-7000-8000-0000000000c1",
				fromTier: "BRONZE",
				toTier: "SILVER",
				reason: "PROMOTION",
				countedRedemptions: DEFAULT_TIER_RULES.silverThreshold,
				occurredAt: NOW,
			};
			reads.histories.set(
				CUSTOMER,
				Array.from({ length: TIER_HISTORY_LIMIT + 1 }, () => change),
			);
			const tier = await service.userTier(signedIn(NEWCOMER), CUSTOMER);
			expect(tier).toMatchObject({ tier: "SILVER", evaluatedAt: NOW });
			expect(tier.history).toHaveLength(TIER_HISTORY_LIMIT);
		});
	});

	describe("distribution", () => {
		it("counts every customer without a higher standing as Bronze", async () => {
			reads.stored = {
				aboveBronze: new Map([
					["SILVER", 3],
					["GOLD", 1],
				]),
				customers: 10,
			};
			await expect(service.distribution(signedIn(NEWCOMER))).resolves.toStrictEqual({ counts: { BRONZE: 6, SILVER: 3, GOLD: 1, DIAMOND: 0 }, total: 10 });
		});

		it("never reports fewer customers than stand above Bronze", async () => {
			reads.stored = { aboveBronze: new Map([["DIAMOND", 2]]), customers: 1 };
			await expect(service.distribution(signedIn(NEWCOMER))).resolves.toStrictEqual({ counts: { BRONZE: 0, SILVER: 0, GOLD: 0, DIAMOND: 2 }, total: 2 });
		});

		it("is refused while tiers are off", async () => {
			availability.on = false;
			await expect(service.distribution(signedIn(NEWCOMER))).rejects.toBeInstanceOf(TiersDisabledError);
		});
	});
});

describe("TierAccessService", () => {
	let reads: InMemoryTierReads;
	let availability: SwitchableTiersAvailability;
	let access: TierAccessService;

	beforeEach(() => {
		reads = new InMemoryTierReads();
		availability = new SwitchableTiersAvailability();
		access = new TierAccessService(reads, availability);
		reads.standings.set(CUSTOMER, { tier: "GOLD", countedRedemptions: 30, holdUntil: null, warning: null, evaluatedAt: NOW });
	});

	it("is off while the flag is off, for anyone", async () => {
		availability.on = false;
		await expect(access.accessFor(CUSTOMER)).resolves.toStrictEqual({ kind: "off" });
		await expect(access.tiersOf([CUSTOMER])).resolves.toBeNull();
	});

	it("gives a signed-out viewer and a never-evaluated customer Bronze, and a customer their stored tier", async () => {
		await expect(access.accessFor(null)).resolves.toStrictEqual({ kind: "on", tier: "BRONZE" });
		await expect(access.accessFor(NEWCOMER)).resolves.toStrictEqual({ kind: "on", tier: "BRONZE" });
		await expect(access.accessFor(CUSTOMER)).resolves.toStrictEqual({ kind: "on", tier: "GOLD" });
	});

	it("maps every asked customer once, Bronze when never evaluated, and reads nothing for none", async () => {
		const tiers = await access.tiersOf([CUSTOMER, NEWCOMER, CUSTOMER]);
		expect(tiers).toStrictEqual(
			new Map([
				[CUSTOMER, "GOLD"],
				[NEWCOMER, "BRONZE"],
			]),
		);
		await expect(access.tiersOf([])).resolves.toStrictEqual(new Map());
	});
});
