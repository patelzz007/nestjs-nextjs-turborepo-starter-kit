import { DAY_MS, epochMs, REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS, REWARD_REFERRAL_OPEN_LINK_LIMIT, type EpochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { ReferralLinkInvalidError, ReferralLinkLimitReachedError, ReferralOwnLinkError, RewardNotReferableError } from "../../domain/errors/reward-referral.errors";
import type { AttributableReferralLink } from "../../domain/policies/reward-referral-link.policy";
import { CreateRewardReferralLinkCommand } from "../commands/create-reward-referral-link/create-reward-referral-link.command";
import { CreateRewardReferralLinkHandler } from "../commands/create-reward-referral-link/create-reward-referral-link.handler";
import { RecordRewardReferralAttributionCommand } from "../commands/record-reward-referral-attribution/record-reward-referral-attribution.command";
import { RecordRewardReferralAttributionHandler } from "../commands/record-reward-referral-attribution/record-reward-referral-attribution.handler";
import type {
	NewReferralLink,
	ReferableRewardLookupPort,
	ReferralLinkIdentity,
	ReferralLinkIdentityGenerator,
	RefereeAttributionPort,
	RewardReferralLinkScope,
	RewardReferralLinkTransactions,
} from "../ports/reward-referral-links.port";

const NOW = epochMs(1_800_000_000_000);
const REWARD_ID = "0199a1b2-0000-7000-8000-000000000001";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

function user(userId: string): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

interface PendingAttribution {
	readonly userId: string;
	readonly token: string;
	readonly expiresAt: EpochMs;
}

/** One in-memory store behind both commands, recording which transaction each ran in. */
class InMemoryReferralLinks implements RewardReferralLinkTransactions, ReferableRewardLookupPort, RefereeAttributionPort {
	public readonly referable = new Set<string>([REWARD_ID]);
	public readonly liveUsers = new Set<string>(["referrer-1", "referee-1"]);
	public readonly links: (NewReferralLink & { refereeUserId: string | null })[] = [];
	public readonly attributions: PendingAttribution[] = [];
	public readonly transactions: { readonly kind: "createLink" | "recordAttribution"; readonly actorUserId: string }[] = [];
	public readonly locked: string[] = [];

	public createLink<T>(actorUserId: string, work: (scope: RewardReferralLinkScope) => Promise<T>): Promise<T> {
		this.transactions.push({ kind: "createLink", actorUserId });
		return work(this.scope());
	}

	public recordAttribution<T>(actorUserId: string, work: (scope: RewardReferralLinkScope) => Promise<T>): Promise<T> {
		this.transactions.push({ kind: "recordAttribution", actorUserId });
		return work(this.scope());
	}

	public isReferable(rewardId: string): Promise<boolean> {
		return Promise.resolve(this.referable.has(rewardId));
	}

	public setPending(userId: string, token: string, expiresAt: EpochMs): Promise<boolean> {
		if (!this.liveUsers.has(userId)) {
			return Promise.resolve(false);
		}
		this.attributions.push({ userId, token, expiresAt });
		return Promise.resolve(true);
	}

	private scope(): RewardReferralLinkScope {
		return {
			rewards: this,
			referees: this,
			lockReferrer: (referrerUserId: string): Promise<boolean> => {
				this.locked.push(referrerUserId);
				return Promise.resolve(this.liveUsers.has(referrerUserId));
			},
			countOpenLinks: (referrerUserId: string, rewardId: string): Promise<number> =>
				Promise.resolve(this.links.filter((link) => link.referrerUserId === referrerUserId && link.rewardId === rewardId && link.refereeUserId === null).length),
			insertLink: (link: NewReferralLink): Promise<void> => {
				this.links.push({ ...link, refereeUserId: null });
				return Promise.resolve();
			},
			findLink: (attributionToken: string): Promise<AttributableReferralLink | null> => {
				const link = this.links.find((candidate) => candidate.attributionToken === attributionToken);
				return Promise.resolve(link === undefined ? null : { rewardId: link.rewardId, referrerUserId: link.referrerUserId, refereeUserId: link.refereeUserId });
			},
		};
	}
}

/** Numbered link identities, so assertions name exact rows and tokens. */
class SequentialIdentities implements ReferralLinkIdentityGenerator {
	private count = 0;

	public next(): ReferralLinkIdentity {
		this.count += 1;
		return { referralId: `referral-${String(this.count)}`, attributionToken: this.count === 1 ? TOKEN : `${TOKEN.slice(0, -2)}${String(this.count).padStart(2, "0")}` };
	}
}

function setup(): { store: InMemoryReferralLinks; create: CreateRewardReferralLinkHandler; record: RecordRewardReferralAttributionHandler } {
	const store = new InMemoryReferralLinks();
	const clock = new FixedClock(NOW);
	return { store, create: new CreateRewardReferralLinkHandler(store, new SequentialIdentities(), clock), record: new RecordRewardReferralAttributionHandler(store, clock) };
}

describe("CreateRewardReferralLinkHandler", () => {
	it("locks the referrer and inserts one PENDING link with a fresh token, in the link transaction", async () => {
		const { store, create } = setup();

		const link = await create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID));

		expect(link).toEqual({ referralId: "referral-1", rewardId: REWARD_ID, attributionToken: TOKEN });
		expect(store.locked).toEqual(["referrer-1"]);
		expect(store.transactions).toEqual([{ kind: "createLink", actorUserId: "referrer-1" }]);
		expect(store.links).toEqual([{ referralId: "referral-1", referrerUserId: "referrer-1", rewardId: REWARD_ID, attributionToken: TOKEN, now: NOW, refereeUserId: null }]);
	});

	it("refuses a reward that cannot be shared, and writes nothing", async () => {
		const { store, create } = setup();
		store.referable.clear();

		await expect(create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID))).rejects.toBeInstanceOf(RewardNotReferableError);
		expect(store.links).toEqual([]);
	});

	it("refuses once the referrer holds the cap of unused links", async () => {
		const { store, create } = setup();
		for (let index = 0; index < REWARD_REFERRAL_OPEN_LINK_LIMIT; index += 1) {
			await create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID));
		}

		await expect(create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID))).rejects.toBeInstanceOf(ReferralLinkLimitReachedError);
		expect(store.links).toHaveLength(REWARD_REFERRAL_OPEN_LINK_LIMIT);
	});

	it("refuses a referrer whose account is gone", async () => {
		const { store, create } = setup();
		store.liveUsers.delete("referrer-1");

		await expect(create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID))).rejects.toBeInstanceOf(RewardNotReferableError);
		expect(store.links).toEqual([]);
	});

	it("needs a signed-in person (an API key is refused before any transaction)", async () => {
		const { store, create } = setup();
		const key: ActorContext = { kind: "api_key", apiKeyId: "key-1", tenantId: "tenant-1", locationId: null, terminalId: null, request: REQUEST };

		await expect(create.execute(new CreateRewardReferralLinkCommand(key, REWARD_ID))).rejects.toBeInstanceOf(AuthenticationError);
		expect(store.transactions).toEqual([]);
	});
});

describe("RecordRewardReferralAttributionHandler", () => {
	it("stores the link as the referee's pending attribution for the shared window", async () => {
		const { store, create, record } = setup();
		await create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID));

		const attribution = await record.execute(new RecordRewardReferralAttributionCommand(user("referee-1"), TOKEN));

		const expiresAt = NOW + REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS * DAY_MS;
		expect(attribution).toEqual({ rewardId: REWARD_ID, expiresAt });
		expect(store.attributions).toEqual([{ userId: "referee-1", token: TOKEN, expiresAt }]);
		expect(store.transactions.at(-1)).toEqual({ kind: "recordAttribution", actorUserId: "referee-1" });
	});

	it("refuses an unknown token and a link another referee already used", async () => {
		const { store, create, record } = setup();
		await create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID));
		const [link] = store.links;
		if (link !== undefined) {
			link.refereeUserId = "someone-else";
		}

		await expect(record.execute(new RecordRewardReferralAttributionCommand(user("referee-1"), TOKEN))).rejects.toBeInstanceOf(ReferralLinkInvalidError);
		await expect(record.execute(new RecordRewardReferralAttributionCommand(user("referee-1"), `${TOKEN.slice(0, -1)}Z`))).rejects.toBeInstanceOf(ReferralLinkInvalidError);
		expect(store.attributions).toEqual([]);
	});

	it("refuses the referrer's own link", async () => {
		const { store, create, record } = setup();
		await create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID));

		await expect(record.execute(new RecordRewardReferralAttributionCommand(user("referrer-1"), TOKEN))).rejects.toBeInstanceOf(ReferralOwnLinkError);
		expect(store.attributions).toEqual([]);
	});

	it("refuses when the referee's account is gone", async () => {
		const { store, create, record } = setup();
		await create.execute(new CreateRewardReferralLinkCommand(user("referrer-1"), REWARD_ID));
		store.liveUsers.delete("referee-1");

		await expect(record.execute(new RecordRewardReferralAttributionCommand(user("referee-1"), TOKEN))).rejects.toBeInstanceOf(ReferralLinkInvalidError);
	});
});
