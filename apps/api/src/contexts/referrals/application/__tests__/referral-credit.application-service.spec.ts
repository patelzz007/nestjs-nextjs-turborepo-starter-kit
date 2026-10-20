import { DAY_MS, epochMs, type EpochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { ConflictError } from "../../../../platform/application/errors/app-error";
import { RewardReferral } from "../../domain/aggregates/reward-referral.aggregate";
import { ReferrerCredited, SignupReferralSucceeded } from "../../domain/events/referral.events";
import type { RewardReferralRepository, SignupReferralSuccessRepository } from "../../domain/repositories/referral.repositories";
import type { ReferralBonusStockPort, ReferrerBonus } from "../ports/referral-credit.port";
import { ReferralCreditApplicationService } from "../services/referral-credit.application-service";

const NOW = epochMs(1_792_195_200_000);
const BONUS: ReferrerBonus = { referrerRewardId: "bonus-1", title: "Free cake", expiryDate: epochMs(NOW + 365 * DAY_MS) };

/**
 * Referrals by `reward:referee`, as the Prisma adapter keeps them: only a PENDING one is found, and a
 * credit is a compare-and-set on PENDING (a referral credited concurrently refuses the save). Locks and
 * saves are recorded.
 */
class InMemoryReferrals implements RewardReferralRepository {
	public readonly locked: string[] = [];
	public readonly saved: { readonly id: string; readonly creditedAt: EpochMs | null }[] = [];
	/** Referrals a concurrent checkout credits between this one's lock and save. */
	public readonly creditedConcurrently = new Set<string>();
	private readonly pending = new Map<string, { readonly key: string }>();
	private readonly credited = new Set<string>();

	public seed(rewardId: string, refereeUserId: string): this {
		this.pending.set(`referral-${rewardId}`, { key: `${rewardId}:${refereeUserId}` });
		return this;
	}

	public lockPendingFor(rewardId: string, refereeUserId: string): Promise<RewardReferral | null> {
		this.locked.push(`${rewardId}:${refereeUserId}`);
		const id = [...this.pending.keys()].find((candidate) => this.pending.get(candidate)?.key === `${rewardId}:${refereeUserId}` && !this.credited.has(candidate));
		return Promise.resolve(id === undefined ? null : RewardReferral.pending({ id, rewardId, referrerUserId: "referrer-1", refereeUserId }));
	}

	public save(referral: RewardReferral): Promise<void> {
		const creditedAt = referral.creditedAtTime;
		if (creditedAt === null) {
			return Promise.resolve();
		}
		if (this.credited.has(referral.id) || this.creditedConcurrently.has(referral.id)) {
			return Promise.reject(new ConflictError({ message: `Referral ${referral.id} was changed by another request.` }));
		}
		this.credited.add(referral.id);
		this.saved.push({ id: referral.id, creditedAt });
		return Promise.resolve();
	}
}

/** A bonus stock that has a bonus for the listed rewards only. */
class ScriptedBonusStock implements ReferralBonusStockPort {
	public readonly asked: string[] = [];

	public constructor(private readonly stocked: ReadonlySet<string>) {}

	public creditReferral(rewardId: string): Promise<ReferrerBonus | null> {
		this.asked.push(rewardId);
		return Promise.resolve(this.stocked.has(rewardId) ? BONUS : null);
	}
}

/** Stamps one referee's signup referral once. */
class ScriptedSignupReferrals implements SignupReferralSuccessRepository {
	private stamped = false;

	public markSuccessful(refereeUserId: string): Promise<string | null> {
		if (this.stamped || refereeUserId !== "referee-1") {
			return Promise.resolve(null);
		}
		this.stamped = true;
		return Promise.resolve("signup-referral-1");
	}
}

describe("ReferralCreditApplicationService.creditReferrer", () => {
	it("locks the referral, takes the reward's bonus, credits and saves the referral, and collects ReferrerCredited", async () => {
		const referrals = new InMemoryReferrals().seed("reward-1", "referee-1");
		const events = new TransactionalEventCollector();
		const service = new ReferralCreditApplicationService(referrals, new ScriptedSignupReferrals(), new ScriptedBonusStock(new Set(["reward-1"])), events);

		await expect(service.creditReferrer("reward-1", "referee-1", NOW)).resolves.toBe("referral-reward-1");

		expect(referrals.locked).toEqual(["reward-1:referee-1"]);
		expect(referrals.saved).toEqual([{ id: "referral-reward-1", creditedAt: NOW }]);
		const [event] = events.take();
		expect(event).toBeInstanceOf(ReferrerCredited);
		expect(event).toMatchObject({ referralId: "referral-reward-1", referrerRewardId: "bonus-1", referrerRewardTitle: "Free cake" });
	});

	it("credits a referral once: a second redemption finds it no longer PENDING", async () => {
		const referrals = new InMemoryReferrals().seed("reward-1", "referee-1");
		const stock = new ScriptedBonusStock(new Set(["reward-1"]));
		const service = new ReferralCreditApplicationService(referrals, new ScriptedSignupReferrals(), stock, new TransactionalEventCollector());

		await service.creditReferrer("reward-1", "referee-1", NOW);

		await expect(service.creditReferrer("reward-1", "referee-1", NOW)).resolves.toBeNull();
		expect(stock.asked).toEqual(["reward-1"]);
		expect(referrals.saved).toHaveLength(1);
	});

	it("propagates a credit a concurrent checkout made first, so the whole sale rolls back", async () => {
		const referrals = new InMemoryReferrals().seed("reward-1", "referee-1");
		referrals.creditedConcurrently.add("referral-reward-1");
		const events = new TransactionalEventCollector();
		const service = new ReferralCreditApplicationService(referrals, new ScriptedSignupReferrals(), new ScriptedBonusStock(new Set(["reward-1"])), events);

		await expect(service.creditReferrer("reward-1", "referee-1", NOW)).rejects.toBeInstanceOf(ConflictError);
		expect(events.pendingCount()).toBe(0);
	});

	it("does not touch the reward's stock when nothing is pending", async () => {
		const stock = new ScriptedBonusStock(new Set(["reward-1"]));
		const service = new ReferralCreditApplicationService(new InMemoryReferrals(), new ScriptedSignupReferrals(), stock, new TransactionalEventCollector());

		await expect(service.creditReferrer("reward-1", "referee-1", NOW)).resolves.toBeNull();
		expect(stock.asked).toEqual([]);
	});

	it("leaves the referral PENDING (nothing written, nothing collected) when the reward has no bonus left", async () => {
		const referrals = new InMemoryReferrals().seed("reward-1", "referee-1");
		const events = new TransactionalEventCollector();
		const service = new ReferralCreditApplicationService(referrals, new ScriptedSignupReferrals(), new ScriptedBonusStock(new Set()), events);

		await expect(service.creditReferrer("reward-1", "referee-1", NOW)).resolves.toBeNull();
		expect(referrals.saved).toEqual([]);
		expect(events.pendingCount()).toBe(0);
	});
});

describe("ReferralCreditApplicationService.markSignupReferralSuccessful", () => {
	it("stamps the referee's signup referral once and collects SignupReferralSucceeded only when it did", async () => {
		const events = new TransactionalEventCollector();
		const service = new ReferralCreditApplicationService(new InMemoryReferrals(), new ScriptedSignupReferrals(), new ScriptedBonusStock(new Set()), events);

		await expect(service.markSignupReferralSuccessful("referee-1", NOW)).resolves.toBe("signup-referral-1");
		await expect(service.markSignupReferralSuccessful("referee-1", NOW)).resolves.toBeNull();

		expect(events.take()).toEqual([new SignupReferralSucceeded(NOW, "signup-referral-1")]);
	});
});
