import type { Prisma } from "@prisma/client";
import { epochMs, SIGNUP_REFERRAL_CODE_TTL_MS } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SignupReferralCodeError } from "../../application/errors/signup-referral.errors";
import type { ReferralBonusStockPort } from "../../application/ports/referral-credit.port";
import type { AcceptedSignupReferral } from "../../application/ports/signup-referral.port";
import { SignupReferralSucceeded } from "../../domain/events/referral.events";
import { createReferralCreditPort, createReferralsTransactionalPorts } from "../persistence/referrals-transactional-ports";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const OWNER_ID = "owner-a";
const CODE_ID = "code-a";
const ACCEPTED: AcceptedSignupReferral = { canonical: "AB23CD45", referrerUserId: OWNER_ID, referralCodeId: CODE_ID };

type FindCode = (args: Prisma.SignupReferralCodeFindUniqueArgs) => Promise<object | null>;
type CreateReferral = (args: Prisma.SignupReferralCreateArgs) => Promise<object>;
type FindReferral = (args: Prisma.SignupReferralFindFirstArgs) => Promise<{ readonly id: string } | null>;
type UpdateReferrals = (args: Prisma.SignupReferralUpdateManyArgs) => Promise<Prisma.BatchPayload>;

interface FakeTransaction {
	readonly db: PrismaService;
	readonly lockedRows: Mock<() => Promise<number>>;
	readonly findCode: Mock<FindCode>;
	readonly createReferral: Mock<CreateReferral>;
	readonly findReferral: Mock<FindReferral>;
	readonly updateReferrals: Mock<UpdateReferrals>;
}

/** The code row as the validation read selects it. */
function codeRow(owner: { readonly isActive?: boolean; readonly latestCodeId?: string } = {}): object {
	return {
		id: CODE_ID,
		userId: OWNER_ID,
		expiresAt: BigInt(NOW + SIGNUP_REFERRAL_CODE_TTL_MS),
		isDeleted: false,
		user: { isDeleted: false, isActive: owner.isActive ?? true, signupReferralCodes: [{ id: owner.latestCodeId ?? CODE_ID }] },
	};
}

function transaction(): FakeTransaction {
	const lockedRows = vi.fn<() => Promise<number>>().mockResolvedValue(1);
	const findCode = vi.fn<FindCode>().mockResolvedValue(codeRow());
	const createReferral = vi.fn<CreateReferral>().mockResolvedValue({});
	const findReferral = vi.fn<FindReferral>().mockResolvedValue(null);
	const updateReferrals = vi.fn<UpdateReferrals>().mockResolvedValue({ count: 1 });
	const db = Object.assign(new PrismaService(createTestTypedConfig()), {
		$executeRaw: lockedRows,
		signupReferralCode: { findUnique: findCode },
		signupReferral: { create: createReferral, findFirst: findReferral, updateMany: updateReferrals },
	});
	return { db, lockedRows, findCode, createReferral, findReferral, updateReferrals };
}

describe("createReferralsTransactionalPorts", () => {
	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(NOW);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("signupReferrals.attachSignupReferral", () => {
		it("locks the owner, re-validates the code on the signup transaction, then inserts the referral at the account's creation time", async () => {
			const tx = transaction();

			await createReferralsTransactionalPorts(tx.db).signupReferrals.attachSignupReferral(ACCEPTED, { id: "referee-b", createdAt: NOW });

			expect(tx.lockedRows).toHaveBeenCalledOnce();
			expect(tx.findCode.mock.calls.map(([args]) => args.where)).toEqual([{ code: "AB23CD45" }]);
			expect(tx.createReferral).toHaveBeenCalledWith({ data: { referrerUserId: OWNER_ID, refereeUserId: "referee-b", referralCodeId: CODE_ID, createdAt: BigInt(NOW) } });
		});

		it("refuses when the owner was deactivated after the first check (no referral inserted)", async () => {
			const tx = transaction();
			tx.findCode.mockResolvedValue(codeRow({ isActive: false }));

			await expect(createReferralsTransactionalPorts(tx.db).signupReferrals.attachSignupReferral(ACCEPTED, { id: "referee-b", createdAt: NOW })).rejects.toMatchObject({
				code: "REFERRAL_CODE_UNAVAILABLE",
			});
			expect(tx.createReferral).not.toHaveBeenCalled();
		});

		it("refuses when the job issued a successor after the first check (the accepted code is no longer the latest)", async () => {
			const tx = transaction();
			tx.findCode.mockResolvedValue(codeRow({ latestCodeId: "code-successor" }));

			await expect(createReferralsTransactionalPorts(tx.db).signupReferrals.attachSignupReferral(ACCEPTED, { id: "referee-b", createdAt: NOW })).rejects.toMatchObject({
				code: "REFERRAL_CODE_EXPIRED",
			});
			expect(tx.createReferral).not.toHaveBeenCalled();
		});

		it("refuses a self-referral and a vanished owner as unavailable", async () => {
			const tx = transaction();
			const ports = createReferralsTransactionalPorts(tx.db);

			await expect(ports.signupReferrals.attachSignupReferral(ACCEPTED, { id: OWNER_ID, createdAt: NOW })).rejects.toBeInstanceOf(SignupReferralCodeError);
			tx.lockedRows.mockResolvedValue(0);
			await expect(ports.signupReferrals.attachSignupReferral(ACCEPTED, { id: "referee-b", createdAt: NOW })).rejects.toMatchObject({ code: "REFERRAL_CODE_UNAVAILABLE" });
			expect(tx.createReferral).not.toHaveBeenCalled();
		});
	});
});

describe("createReferralCreditPort().markSignupReferralSuccessful", () => {
	const noBonus: ReferralBonusStockPort = { creditReferral: (): Promise<null> => Promise.resolve(null) };

	it("stamps the referee's open signup referral with a conditional update, returns its id and records SignupReferralSucceeded", async () => {
		const tx = transaction();
		const events = new TransactionalEventCollector();
		tx.findReferral.mockResolvedValue({ id: "signup-referral-1" });

		await expect(createReferralCreditPort(tx.db, events, noBonus).markSignupReferralSuccessful("referee-b", epochMs(NOW))).resolves.toBe("signup-referral-1");

		expect(tx.updateReferrals).toHaveBeenCalledWith({
			where: { id: "signup-referral-1", isDeleted: false, successfulAt: null },
			data: { successfulAt: BigInt(NOW), updatedAt: BigInt(NOW) },
		});
		expect(events.take()).toEqual([new SignupReferralSucceeded(epochMs(NOW), "signup-referral-1")]);
	});

	it("stamps nothing and records nothing when the referee has no open referral, or a concurrent checkout stamped it first", async () => {
		const tx = transaction();
		const events = new TransactionalEventCollector();
		const port = createReferralCreditPort(tx.db, events, noBonus);

		await expect(port.markSignupReferralSuccessful("referee-b", epochMs(NOW))).resolves.toBeNull();
		expect(tx.updateReferrals).not.toHaveBeenCalled();
		tx.findReferral.mockResolvedValue({ id: "signup-referral-1" });
		tx.updateReferrals.mockResolvedValue({ count: 0 });
		await expect(port.markSignupReferralSuccessful("referee-b", epochMs(NOW))).resolves.toBeNull();
		expect(events.pendingCount()).toBe(0);
	});
});

type FindRewardReferral = (args: Prisma.RewardReferralFindFirstArgs) => Promise<{ readonly id: string } | null>;
type ListRewardReferrals = (
	args: Prisma.RewardReferralFindManyArgs,
) => Promise<readonly { readonly id: string; readonly referrerUserId: string; readonly creditedAt: bigint | null }[]>;
type UpdateRewardReferrals = (args: Prisma.RewardReferralUpdateManyArgs) => Promise<Prisma.BatchPayload>;

interface FakeRewardReferrals {
	readonly db: PrismaService;
	readonly findFirst: Mock<FindRewardReferral>;
	readonly findMany: Mock<ListRewardReferrals>;
	readonly updateMany: Mock<UpdateRewardReferrals>;
}

function rewardReferrals(): FakeRewardReferrals {
	const findFirst = vi.fn<FindRewardReferral>().mockResolvedValue({ id: "referral-1" });
	const findMany = vi.fn<ListRewardReferrals>().mockResolvedValue([]);
	const updateMany = vi.fn<UpdateRewardReferrals>().mockResolvedValue({ count: 1 });
	const db = Object.assign(new PrismaService(createTestTypedConfig()), { rewardReferral: { findFirst, findMany, updateMany } });
	return { db, findFirst, findMany, updateMany };
}

describe("createReferralsTransactionalPorts().rewardReferralAttribution.attachReferee", () => {
	const unattachedOrSame = {
		attributionToken: "token-1",
		rewardId: "reward-1",
		status: "PENDING",
		isDeleted: false,
		OR: [{ refereeUserId: null }, { refereeUserId: "referee-b" }],
	};

	it("attaches a PENDING referral to its first referee with a compare-and-set, returning its id", async () => {
		const tx = rewardReferrals();

		await expect(createReferralsTransactionalPorts(tx.db).rewardReferralAttribution.attachReferee("token-1", "reward-1", "referee-b")).resolves.toBe("referral-1");

		expect(tx.findFirst.mock.calls.map(([args]) => args.where)).toEqual([unattachedOrSame]);
		expect(tx.updateMany).toHaveBeenCalledWith({ where: { ...unattachedOrSame, id: "referral-1" }, data: { refereeUserId: "referee-b" } });
	});

	it("attaches nothing for an unknown token, and nothing when another referee took it concurrently", async () => {
		const tx = rewardReferrals();
		const attribution = createReferralsTransactionalPorts(tx.db).rewardReferralAttribution;
		tx.findFirst.mockResolvedValueOnce(null);

		await expect(attribution.attachReferee("token-1", "reward-1", "referee-b")).resolves.toBeNull();
		expect(tx.updateMany).not.toHaveBeenCalled();
		tx.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(attribution.attachReferee("token-1", "reward-1", "referee-b")).resolves.toBeNull();
	});
});

describe("createReferralsTransactionalPorts().referrerCreditNotices", () => {
	it("lists owed credits oldest first, and strictly after the cursor when given", async () => {
		const tx = rewardReferrals();
		tx.findMany.mockResolvedValue([
			{ id: "referral-2", referrerUserId: "referrer-1", creditedAt: BigInt(NOW) },
			{ id: "referral-3", referrerUserId: "referrer-2", creditedAt: null },
		]);
		const notices = createReferralsTransactionalPorts(tx.db).referrerCreditNotices;

		await expect(notices.listUnnotified(50, null)).resolves.toEqual([{ referralId: "referral-2", referrerUserId: "referrer-1", creditedAt: NOW }]);
		await notices.listUnnotified(50, { creditedAt: epochMs(NOW), referralId: "referral-1" });

		const owed = { status: "CREDITED", creditNotifiedAt: null, creditedAt: { not: null }, isDeleted: false };
		expect(tx.findMany.mock.calls.map(([args]) => args.where)).toEqual([owed, { ...owed, OR: [{ creditedAt: { gt: NOW } }, { creditedAt: NOW, id: { gt: "referral-1" } }] }]);
		expect(tx.findMany.mock.calls.map(([args]) => [args.orderBy, args.take])).toEqual([
			[[{ creditedAt: "asc" }, { id: "asc" }], 50],
			[[{ creditedAt: "asc" }, { id: "asc" }], 50],
		]);
	});

	it('marks a credit notified with a compare-and-set on "creditNotifiedAt" IS NULL', async () => {
		const tx = rewardReferrals();
		const notices = createReferralsTransactionalPorts(tx.db).referrerCreditNotices;

		await expect(notices.markNotified("referral-1", epochMs(NOW))).resolves.toBe(true);
		expect(tx.updateMany).toHaveBeenCalledWith({
			where: { id: "referral-1", status: "CREDITED", creditNotifiedAt: null, isDeleted: false },
			data: { creditNotifiedAt: NOW, updatedAt: NOW },
		});
		tx.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(notices.markNotified("referral-1", epochMs(NOW))).resolves.toBe(false);
	});
});

describe("createReferralsTransactionalPorts().signupSuccessNotices", () => {
	type ListSignupReferrals = (args: Prisma.SignupReferralFindManyArgs) => Promise<readonly { readonly id: string; readonly successfulAt: bigint | null }[]>;
	type FindSignupReferral = (args: Prisma.SignupReferralFindUniqueArgs) => Promise<{ readonly referrerUserId: string; readonly refereeUserId: string } | null>;

	function signupReferrals(): {
		readonly db: PrismaService;
		readonly findMany: Mock<ListSignupReferrals>;
		readonly findUnique: Mock<FindSignupReferral>;
		readonly updateMany: Mock<UpdateReferrals>;
	} {
		const findMany = vi.fn<ListSignupReferrals>().mockResolvedValue([
			{ id: "signup-referral-2", successfulAt: BigInt(NOW) },
			{ id: "signup-referral-3", successfulAt: null },
		]);
		const findUnique = vi.fn<FindSignupReferral>().mockResolvedValue({ referrerUserId: "referrer-1", refereeUserId: "referee-1" });
		const updateMany = vi.fn<UpdateReferrals>().mockResolvedValue({ count: 1 });
		const db = Object.assign(new PrismaService(createTestTypedConfig()), { signupReferral: { findMany, findUnique, updateMany } });
		return { db, findMany, findUnique, updateMany };
	}

	it("lists owed notices oldest success first, strictly after the cursor when given", async () => {
		const tx = signupReferrals();
		const notices = createReferralsTransactionalPorts(tx.db).signupSuccessNotices;

		await expect(notices.listOwed(100, null)).resolves.toEqual([{ signupReferralId: "signup-referral-2", successfulAt: NOW }]);
		await notices.listOwed(100, { signupReferralId: "signup-referral-1", successfulAt: epochMs(NOW) });

		const owed = { isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null };
		expect(tx.findMany.mock.calls.map(([args]) => args.where)).toEqual([
			owed,
			{ AND: [owed, { OR: [{ successfulAt: { gt: NOW } }, { successfulAt: NOW, id: { gt: "signup-referral-1" } }] }] },
		]);
		expect(tx.findMany.mock.calls.map(([args]) => [args.orderBy, args.take])).toEqual([
			[[{ successfulAt: "asc" }, { id: "asc" }], 100],
			[[{ successfulAt: "asc" }, { id: "asc" }], 100],
		]);
	});

	it('claims a notice with a compare-and-set on "successNotifiedAt" IS NULL, naming its referrer and referee', async () => {
		const tx = signupReferrals();
		const notices = createReferralsTransactionalPorts(tx.db).signupSuccessNotices;

		await expect(notices.claim("signup-referral-1", epochMs(NOW))).resolves.toEqual({ referrerUserId: "referrer-1", refereeUserId: "referee-1" });
		expect(tx.updateMany).toHaveBeenCalledWith({
			where: { id: "signup-referral-1", isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null },
			data: { successNotifiedAt: BigInt(NOW), updatedAt: BigInt(NOW) },
		});
		tx.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(notices.claim("signup-referral-1", epochMs(NOW))).resolves.toBeNull();
		expect(tx.findUnique).toHaveBeenCalledOnce();
	});
});
