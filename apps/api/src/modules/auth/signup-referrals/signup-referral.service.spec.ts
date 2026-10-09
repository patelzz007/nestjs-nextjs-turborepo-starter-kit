import { Test } from "@nestjs/testing";
import { SIGNUP_REFERRAL_CODE_TTL_MS, SignupReferralRefereeListQuerySchema } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { SignupReferralCodeForValidation } from "./signup-referral-code.validity";
import { SignupReferralCodeError, SignupReferralCodeNotAcceptedError } from "./signup-referral.errors";
import { SignupReferralRepository } from "./signup-referral.repository";
import { SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, SignupReferralService, type AcceptedSignupReferralCode } from "./signup-referral.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const OWNER_ID = "owner-a";
const CODE_ID = "code-a";
const ACCEPTED: AcceptedSignupReferralCode = { canonical: "AB23CD45", referrerUserId: OWNER_ID, referralCodeId: CODE_ID };

function validCodeRow(overrides: Partial<SignupReferralCodeForValidation["owner"]> = {}): SignupReferralCodeForValidation {
	return {
		id: CODE_ID,
		userId: OWNER_ID,
		expiresAt: BigInt(NOW + SIGNUP_REFERRAL_CODE_TTL_MS),
		isDeleted: false,
		owner: { isDeleted: false, isActive: true, latestCodeId: CODE_ID, ...overrides },
	};
}

function codeRow(code: string, expiresAt: number): object {
	return { id: CODE_ID, userId: OWNER_ID, code, expiresAt: BigInt(expiresAt), createdAt: BigInt(NOW), isDeleted: false };
}

describe("SignupReferralService", () => {
	const repository = {
		findCodeForValidation: vi.fn(),
		findLatestCodeForUser: vi.fn(),
		insertCodeInTx: vi.fn(),
		lockCodeOwnerForSignupInTx: vi.fn(),
		insertSignupReferralInTx: vi.fn(),
		listRefereesForReferrer: vi.fn(),
		listUserIdsNeedingCode: vi.fn(),
		lockUserForCodeMaintenanceInTx: vi.fn(),
		findCodeMaintenanceStateInTx: vi.fn(),
		appendCodeIssuedAuditInTx: vi.fn(),
	};
	const tx = new PrismaService(createTestTypedConfig());
	const prisma = { user: { findFirst: vi.fn() }, $transaction: vi.fn() };
	const tenantTx = { withSystemOperation: vi.fn() };
	let service: SignupReferralService;

	beforeEach(async () => {
		vi.resetAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<string>) => handler(tx));
		const moduleRef = await Test.createTestingModule({
			providers: [
				SignupReferralService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: SignupReferralRepository, useValue: repository },
				{ provide: TenantTransactionService, useValue: tenantTx },
			],
		}).compile();
		service = moduleRef.get(SignupReferralService);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("acceptCodeForSignup", () => {
		it("treats an omitted, null or blank code as no referral without reading the database", async () => {
			await expect(service.acceptCodeForSignup(undefined, "web")).resolves.toBeNull();
			await expect(service.acceptCodeForSignup(null, "mobile")).resolves.toBeNull();
			await expect(service.acceptCodeForSignup("   ", "merchant")).resolves.toBeNull();
			expect(repository.findCodeForValidation).not.toHaveBeenCalled();
		});

		it("accepts a folded, trimmed code of an active owner from consumer web signup (and from a request with no client type)", async () => {
			repository.findCodeForValidation.mockResolvedValue(validCodeRow());

			await expect(service.acceptCodeForSignup(" ab23cd45 ", "web")).resolves.toEqual(ACCEPTED);
			await expect(service.acceptCodeForSignup("AB23CD45", undefined)).resolves.toEqual(ACCEPTED);
			expect(repository.findCodeForValidation).toHaveBeenCalledWith("AB23CD45");
		});

		it("refuses a code from mobile, merchant or an unknown client type", async () => {
			await expect(service.acceptCodeForSignup("AB23CD45", "mobile")).rejects.toBeInstanceOf(SignupReferralCodeNotAcceptedError);
			await expect(service.acceptCodeForSignup("AB23CD45", "merchant")).rejects.toBeInstanceOf(SignupReferralCodeNotAcceptedError);
			await expect(service.acceptCodeForSignup("AB23CD45", "something-else")).rejects.toBeInstanceOf(SignupReferralCodeNotAcceptedError);
			expect(repository.findCodeForValidation).not.toHaveBeenCalled();
		});

		it("answers a malformed code as unrecognized without reading the database", async () => {
			await expect(service.acceptCodeForSignup("AB23OD45", "web")).rejects.toMatchObject({ code: "REFERRAL_CODE_UNRECOGNIZED" });
			expect(repository.findCodeForValidation).not.toHaveBeenCalled();
		});

		it("maps each validity rejection to its error code", async () => {
			repository.findCodeForValidation.mockResolvedValueOnce(null);
			await expect(service.acceptCodeForSignup("ZZZZZZZZ", "web")).rejects.toMatchObject({ code: "REFERRAL_CODE_UNRECOGNIZED" });

			repository.findCodeForValidation.mockResolvedValueOnce(validCodeRow({ latestCodeId: "code-newer" }));
			await expect(service.acceptCodeForSignup("AB23CD45", "web")).rejects.toMatchObject({ code: "REFERRAL_CODE_EXPIRED" });

			repository.findCodeForValidation.mockResolvedValueOnce(validCodeRow({ isActive: false }));
			await expect(service.acceptCodeForSignup("AB23CD45", "web")).rejects.toMatchObject({ code: "REFERRAL_CODE_UNAVAILABLE" });
		});
	});

	describe("attachSignupReferralInTx", () => {
		it("locks the owner, re-validates the code on the signup transaction, then inserts the referral at the account's creation time", async () => {
			repository.lockCodeOwnerForSignupInTx.mockResolvedValue(true);
			repository.findCodeForValidation.mockResolvedValue(validCodeRow());

			await service.attachSignupReferralInTx(tx, ACCEPTED, { id: "referee-b", createdAt: NOW });

			expect(repository.lockCodeOwnerForSignupInTx).toHaveBeenCalledWith(tx, OWNER_ID);
			expect(repository.findCodeForValidation).toHaveBeenCalledWith("AB23CD45", tx);
			expect(repository.insertSignupReferralInTx).toHaveBeenCalledWith(tx, { referrerUserId: OWNER_ID, refereeUserId: "referee-b", referralCodeId: CODE_ID, createdAt: NOW });
		});

		it("refuses when the owner was deactivated after the first check (no referral inserted)", async () => {
			repository.lockCodeOwnerForSignupInTx.mockResolvedValue(true);
			repository.findCodeForValidation.mockResolvedValue(validCodeRow({ isActive: false }));

			await expect(service.attachSignupReferralInTx(tx, ACCEPTED, { id: "referee-b", createdAt: NOW })).rejects.toMatchObject({ code: "REFERRAL_CODE_UNAVAILABLE" });
			expect(repository.insertSignupReferralInTx).not.toHaveBeenCalled();
		});

		it("refuses when the job issued a successor after the first check (the accepted code is no longer the latest)", async () => {
			repository.lockCodeOwnerForSignupInTx.mockResolvedValue(true);
			repository.findCodeForValidation.mockResolvedValue(validCodeRow({ latestCodeId: "code-successor" }));

			await expect(service.attachSignupReferralInTx(tx, ACCEPTED, { id: "referee-b", createdAt: NOW })).rejects.toMatchObject({ code: "REFERRAL_CODE_EXPIRED" });
			expect(repository.insertSignupReferralInTx).not.toHaveBeenCalled();
		});

		it("refuses a self-referral and a vanished owner as unavailable", async () => {
			await expect(service.attachSignupReferralInTx(tx, ACCEPTED, { id: OWNER_ID, createdAt: NOW })).rejects.toBeInstanceOf(SignupReferralCodeError);

			repository.lockCodeOwnerForSignupInTx.mockResolvedValue(false);
			await expect(service.attachSignupReferralInTx(tx, ACCEPTED, { id: "referee-b", createdAt: NOW })).rejects.toMatchObject({ code: "REFERRAL_CODE_UNAVAILABLE" });
			expect(repository.insertSignupReferralInTx).not.toHaveBeenCalled();
		});
	});

	describe("getDashboard", () => {
		it("never writes: an account without a code is pending", async () => {
			prisma.user.findFirst.mockResolvedValue({ isDeleted: false, isActive: true });
			repository.findLatestCodeForUser.mockResolvedValue(null);

			await expect(service.getDashboard(OWNER_ID)).resolves.toEqual({ code: null, expiresAt: null, shareable: false, codeState: "pending" });
			expect(repository.insertCodeInTx).not.toHaveBeenCalled();
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("is shareable only while active and inside the window", async () => {
			prisma.user.findFirst.mockResolvedValue({ isDeleted: false, isActive: true });
			repository.findLatestCodeForUser.mockResolvedValue(codeRow("AB23CD45", NOW + 1));

			await expect(service.getDashboard(OWNER_ID)).resolves.toMatchObject({ code: "AB23CD45", shareable: true, codeState: "active" });
		});

		it("labels expiry at now >= expiresAt, before deactivation", async () => {
			prisma.user.findFirst.mockResolvedValue({ isDeleted: false, isActive: false });
			repository.findLatestCodeForUser.mockResolvedValue(codeRow("AB23CD45", NOW));

			await expect(service.getDashboard(OWNER_ID)).resolves.toMatchObject({ code: "AB23CD45", shareable: false, codeState: "expired" });
		});

		it("labels a deactivated caller's in-window code unavailable", async () => {
			prisma.user.findFirst.mockResolvedValue({ isDeleted: false, isActive: false });
			repository.findLatestCodeForUser.mockResolvedValue(codeRow("AB23CD45", NOW + 1));

			await expect(service.getDashboard(OWNER_ID)).resolves.toMatchObject({ shareable: false, codeState: "unavailable" });
		});
	});

	describe("listReferees", () => {
		it("maps the page and loads every referee name in one batched read", async () => {
			const query = SignupReferralRefereeListQuerySchema.parse({});
			repository.listRefereesForReferrer.mockResolvedValue({
				items: [
					{ id: "ref-1", refereeUserId: "referee-1", createdAt: BigInt(NOW), successfulAt: BigInt(NOW + 1) },
					{ id: "ref-2", refereeUserId: "referee-2", createdAt: BigInt(NOW - 1), successfulAt: null },
				],
				total: 2,
				page: 1,
				totalPages: 1,
				nextCursor: null,
				hasNext: false,
				hasPrevious: false,
			});
			const findMany = vi.fn().mockResolvedValue([
				{ id: "referee-1", fullName: "Bob" },
				{ id: "referee-2", fullName: "Carol" },
			]);
			tenantTx.withSystemOperation.mockImplementation(async (_context: object, handler: (client: { user: { findMany: typeof findMany } }) => Promise<object>) =>
				handler({ user: { findMany } }),
			);

			const page = await service.listReferees(OWNER_ID, query);

			expect(page.items).toEqual([
				{ fullName: "Bob", createdAt: NOW, status: "redeemed" },
				{ fullName: "Carol", createdAt: NOW - 1, status: "not_redeemed" },
			]);
			expect(findMany).toHaveBeenCalledOnce();
		});
	});

	describe("maintainReferralCodes", () => {
		it("issues a first code and a successor, each under the user's lock with an audit row, and pages until no user needs one", async () => {
			repository.listUserIdsNeedingCode.mockResolvedValueOnce(["user-new", "user-expired"]).mockResolvedValueOnce([]);
			repository.lockUserForCodeMaintenanceInTx.mockResolvedValue(true);
			repository.findCodeMaintenanceStateInTx
				.mockResolvedValueOnce({ isDeleted: false, latestExpiresAt: null })
				.mockResolvedValueOnce({ isDeleted: false, latestExpiresAt: BigInt(NOW) });
			repository.insertCodeInTx.mockResolvedValueOnce({ id: "code-first" }).mockResolvedValueOnce({ id: "code-successor" });

			await expect(service.maintainReferralCodes()).resolves.toEqual({ firstCodes: 1, successors: 1, failed: 0 });

			expect(repository.listUserIdsNeedingCode).toHaveBeenNthCalledWith(1, NOW, SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, null);
			expect(repository.listUserIdsNeedingCode).toHaveBeenNthCalledWith(2, NOW, SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, "user-expired");
			expect(repository.lockUserForCodeMaintenanceInTx).toHaveBeenCalledWith(tx, "user-new");
			expect(repository.insertCodeInTx).toHaveBeenCalledWith(tx, "user-new", NOW);
			expect(repository.appendCodeIssuedAuditInTx).toHaveBeenCalledWith(tx, { ownerUserId: "user-new", referralCodeId: "code-first", successor: false });
			expect(repository.appendCodeIssuedAuditInTx).toHaveBeenCalledWith(tx, { ownerUserId: "user-expired", referralCodeId: "code-successor", successor: true });
		});

		it("inserts nothing when, under the lock, another run already issued a valid code or the user was deleted", async () => {
			repository.listUserIdsNeedingCode.mockResolvedValueOnce(["user-raced", "user-deleted"]).mockResolvedValueOnce([]);
			repository.lockUserForCodeMaintenanceInTx.mockResolvedValue(true);
			repository.findCodeMaintenanceStateInTx
				.mockResolvedValueOnce({ isDeleted: false, latestExpiresAt: BigInt(NOW + 1) })
				.mockResolvedValueOnce({ isDeleted: true, latestExpiresAt: null });

			await expect(service.maintainReferralCodes()).resolves.toEqual({ firstCodes: 0, successors: 0, failed: 0 });
			expect(repository.insertCodeInTx).not.toHaveBeenCalled();
		});

		it("logs one user's failure and carries on with the rest", async () => {
			repository.listUserIdsNeedingCode.mockResolvedValueOnce(["user-broken", "user-ok"]).mockResolvedValueOnce([]);
			repository.lockUserForCodeMaintenanceInTx.mockResolvedValue(true);
			repository.findCodeMaintenanceStateInTx.mockResolvedValue({ isDeleted: false, latestExpiresAt: null });
			repository.insertCodeInTx.mockRejectedValueOnce(new Error("allocation failed")).mockResolvedValueOnce({ id: "code-ok" });

			await expect(service.maintainReferralCodes()).resolves.toEqual({ firstCodes: 1, successors: 0, failed: 1 });
		});
	});
});
