import { SIGNUP_REFERRALS_SCREEN_PATH } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION, SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE, SignupReferralRepository } from "./signup-referral.repository";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const LATEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }];

describe("SignupReferralRepository", () => {
	const db = {
		signupReferralCode: { findFirst: vi.fn(), findUnique: vi.fn() },
		signupReferral: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
		user: { findMany: vi.fn(), findUnique: vi.fn() },
		rewardNotification: { createMany: vi.fn() },
		rewardAuditLog: { createMany: vi.fn() },
		$executeRaw: vi.fn<(query: TemplateStringsArray, ...values: string[]) => Promise<number>>(),
	};
	// Typed once as PrismaService: passing the raw intersection to every Prisma.TransactionClient
	// parameter makes the type checker re-compare each overridden delegate on every call.
	const prisma: PrismaService = Object.assign(new PrismaService(createTestTypedConfig()), db);
	const repository = new SignupReferralRepository(prisma);

	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe("findCodeForValidation", () => {
		it("reads the code row, its owner's state and the owner's latest code id in ONE unique-index lookup", async () => {
			db.signupReferralCode.findUnique.mockResolvedValue({
				id: "code-a",
				userId: "owner-a",
				expiresAt: BigInt(NOW),
				isDeleted: false,
				user: { isDeleted: false, isActive: true, signupReferralCodes: [{ id: "code-b" }] },
			});

			const row = await repository.findCodeForValidation("AB23CD45");

			expect(db.signupReferralCode.findUnique).toHaveBeenCalledOnce();
			expect(db.signupReferralCode.findUnique).toHaveBeenCalledWith({
				where: { code: "AB23CD45" },
				select: {
					id: true,
					userId: true,
					expiresAt: true,
					isDeleted: true,
					user: { select: { isDeleted: true, isActive: true, signupReferralCodes: { where: { isDeleted: false }, orderBy: LATEST_FIRST, take: 1, select: { id: true } } } },
				},
			});
			expect(row).toEqual({ id: "code-a", userId: "owner-a", expiresAt: BigInt(NOW), isDeleted: false, owner: { isDeleted: false, isActive: true, latestCodeId: "code-b" } });
		});

		it("returns null for an unknown code", async () => {
			db.signupReferralCode.findUnique.mockResolvedValue(null);

			await expect(repository.findCodeForValidation("ZZZZZZZZ")).resolves.toBeNull();
		});
	});

	describe("row locks", () => {
		it("locks the code owner FOR SHARE and a job user FOR UPDATE, reporting whether the row exists", async () => {
			db.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

			await expect(repository.lockCodeOwnerForSignupInTx(prisma, "owner-a")).resolves.toBe(true);
			await expect(repository.lockUserForCodeMaintenanceInTx(prisma, "gone")).resolves.toBe(false);

			const [shareSql, updateSql] = db.$executeRaw.mock.calls.map(([query]) => query.join("?"));
			expect(shareSql).toContain("FOR SHARE");
			expect(updateSql).toContain("FOR UPDATE");
		});
	});

	describe("listUserIdsNeedingCode", () => {
		it("selects only non-deleted users with no unexpired code, in id order after the cursor", async () => {
			db.user.findMany.mockResolvedValue([{ id: "user-b" }]);

			await expect(repository.listUserIdsNeedingCode(NOW, 50, "user-a")).resolves.toEqual(["user-b"]);
			expect(db.user.findMany).toHaveBeenCalledWith({
				where: { isDeleted: false, signupReferralCodes: { none: { isDeleted: false, expiresAt: { gt: BigInt(NOW) } } }, id: { gt: "user-a" } },
				orderBy: { id: "asc" },
				take: 50,
				select: { id: true },
			});
		});
	});

	describe("findCodeMaintenanceStateInTx", () => {
		it("reports a user's deletion and latest code expiry", async () => {
			db.user.findUnique
				.mockResolvedValueOnce({ isDeleted: false, signupReferralCodes: [{ expiresAt: BigInt(NOW) }] })
				.mockResolvedValueOnce({ isDeleted: false, signupReferralCodes: [] });

			await expect(repository.findCodeMaintenanceStateInTx(prisma, "user-a")).resolves.toEqual({ isDeleted: false, latestExpiresAt: BigInt(NOW) });
			await expect(repository.findCodeMaintenanceStateInTx(prisma, "user-b")).resolves.toEqual({ isDeleted: false, latestExpiresAt: null });
		});
	});

	describe("appendCodeIssuedAuditInTx", () => {
		it("records a system-actor entry naming the owner and the code row, never the code value", async () => {
			await repository.appendCodeIssuedAuditInTx(prisma, { ownerUserId: "user-a", referralCodeId: "code-a", successor: true });

			expect(db.rewardAuditLog.createMany).toHaveBeenCalledWith({
				data: [
					{
						actorUserId: null,
						organizationId: null,
						action: SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION,
						metadata: { actor: "system", ownerUserId: "user-a", referralCodeId: "code-a", successor: true },
					},
				],
			});
		});
	});

	describe("markSuccessfulInTx", () => {
		it("stamps only a referral whose successfulAt is still null and returns its id", async () => {
			db.signupReferral.findFirst.mockResolvedValue({ id: "ref-1" });
			db.signupReferral.updateMany.mockResolvedValue({ count: 1 });

			await expect(repository.markSuccessfulInTx(prisma, "referee-b", NOW)).resolves.toBe("ref-1");
			expect(db.signupReferral.updateMany).toHaveBeenCalledWith({
				where: { id: "ref-1", isDeleted: false, successfulAt: null },
				data: { successfulAt: BigInt(NOW), updatedAt: BigInt(NOW) },
			});
		});

		it("returns null when a concurrent checkout stamped it first, or there is no referral", async () => {
			db.signupReferral.findFirst.mockResolvedValueOnce({ id: "ref-1" }).mockResolvedValueOnce(null);
			db.signupReferral.updateMany.mockResolvedValue({ count: 0 });

			await expect(repository.markSuccessfulInTx(prisma, "referee-b", NOW)).resolves.toBeNull();
			await expect(repository.markSuccessfulInTx(prisma, "referee-c", NOW)).resolves.toBeNull();
			expect(db.signupReferral.updateMany).toHaveBeenCalledOnce();
		});
	});

	describe("success notification", () => {
		it("claims an owed notification with a conditional update", async () => {
			db.signupReferral.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

			await expect(repository.claimSuccessNotificationInTx(prisma, "ref-1", NOW)).resolves.toBe(true);
			await expect(repository.claimSuccessNotificationInTx(prisma, "ref-1", NOW)).resolves.toBe(false);
			expect(db.signupReferral.updateMany).toHaveBeenCalledWith({
				where: { id: "ref-1", isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null },
				data: { successNotifiedAt: BigInt(NOW), updatedAt: BigInt(NOW) },
			});
		});

		it("pages owed notifications by (successfulAt, id) after the cursor", async () => {
			db.signupReferral.findMany.mockResolvedValue([{ id: "ref-2", successfulAt: BigInt(NOW) }]);

			await expect(repository.listPendingSuccessNotifications(25, { id: "ref-1", successfulAt: BigInt(NOW) })).resolves.toEqual([{ id: "ref-2", successfulAt: BigInt(NOW) }]);
			expect(db.signupReferral.findMany).toHaveBeenCalledWith({
				where: {
					AND: [
						{ isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null },
						{ OR: [{ successfulAt: { gt: BigInt(NOW) } }, { successfulAt: BigInt(NOW), id: { gt: "ref-1" } }] },
					],
				},
				orderBy: [{ successfulAt: "asc" }, { id: "asc" }],
				take: 25,
				select: { id: true, successfulAt: true },
			});
		});

		it("writes the in-app notification with the referee's name and a link to the Referrals screen", async () => {
			await repository.insertSuccessNotificationInTx(prisma, "ref-1", { referrerUserId: "referrer-a", refereeFullName: "Bob Referee" });

			expect(db.rewardNotification.createMany).toHaveBeenCalledWith({
				data: [
					{
						userId: "referrer-a",
						type: SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE,
						title: "Referral successful",
						body: "Bob Referee redeemed a reward. Your referral is successful.",
						metadata: { signupReferralId: "ref-1", href: SIGNUP_REFERRALS_SCREEN_PATH },
					},
				],
			});
		});
	});

	describe("admin summaries", () => {
		it("maps a page of referees in one batched read and skips the read for an empty page", async () => {
			db.signupReferral.findMany.mockResolvedValue([{ refereeUserId: "referee-b", successfulAt: null, referrerUser: { id: "referrer-a", fullName: "Alice" } }]);

			const summaries = await repository.findAdminSummariesForReferees(["referee-b", "plain-c"]);

			expect(summaries.get("referee-b")).toEqual({ referrer: { id: "referrer-a", fullName: "Alice" }, status: "not_redeemed" });
			expect(summaries.has("plain-c")).toBe(false);
			expect(db.signupReferral.findMany).toHaveBeenCalledOnce();

			await expect(repository.findAdminSummariesForReferees([])).resolves.toEqual(new Map());
			expect(db.signupReferral.findMany).toHaveBeenCalledOnce();
		});
	});
});
