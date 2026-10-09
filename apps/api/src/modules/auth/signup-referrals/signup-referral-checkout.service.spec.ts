import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { currentRlsContext } from "../../../prisma/rls-context";
import { SIGNUP_REFERRAL_NOTIFY_PAGE_SIZE, SignupReferralCheckoutService } from "./signup-referral-checkout.service";
import { SignupReferralRepository } from "./signup-referral.repository";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const SUBJECT = { referrerUserId: "referrer-a", refereeFullName: "Bob Referee" };

describe("SignupReferralCheckoutService", () => {
	const repository = {
		markSuccessfulInTx: vi.fn(),
		claimSuccessNotificationInTx: vi.fn(),
		findNotificationSubjectInTx: vi.fn(),
		insertSuccessNotificationInTx: vi.fn(),
		listPendingSuccessNotifications: vi.fn(),
	};
	const tx = new PrismaService(createTestTypedConfig());
	const prisma = { $transaction: vi.fn() };
	let service: SignupReferralCheckoutService;

	beforeEach(async () => {
		vi.resetAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<string>) => handler(tx));
		const moduleRef = await Test.createTestingModule({
			providers: [SignupReferralCheckoutService, { provide: PrismaService, useValue: prisma }, { provide: SignupReferralRepository, useValue: repository }],
		}).compile();
		service = moduleRef.get(SignupReferralCheckoutService);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("stamps success on the caller's checkout transaction", async () => {
		repository.markSuccessfulInTx.mockResolvedValue("signup-referral-1");

		await expect(service.markSuccessfulInTransaction(tx, "referee-b", NOW)).resolves.toBe("signup-referral-1");
		expect(repository.markSuccessfulInTx).toHaveBeenCalledWith(tx, "referee-b", NOW);
	});

	describe("deliver", () => {
		it("claims the notification, then writes it with the referee's current name, in one transaction under the notify operation", async () => {
			repository.claimSuccessNotificationInTx.mockImplementation((): Promise<boolean> => {
				expect(currentRlsContext().systemOperation).toBe("auth.signup_referrals.notify_success");
				return Promise.resolve(true);
			});
			repository.findNotificationSubjectInTx.mockResolvedValue(SUBJECT);

			await expect(service.deliver("signup-referral-1")).resolves.toBe("delivered");
			expect(repository.claimSuccessNotificationInTx).toHaveBeenCalledWith(tx, "signup-referral-1", NOW);
			expect(repository.insertSuccessNotificationInTx).toHaveBeenCalledWith(tx, "signup-referral-1", SUBJECT);
		});

		it("writes nothing when another deliverer already claimed it (no duplicate notification)", async () => {
			repository.claimSuccessNotificationInTx.mockResolvedValue(false);

			await expect(service.deliver("signup-referral-1")).resolves.toBe("already-delivered");
			expect(repository.insertSuccessNotificationInTx).not.toHaveBeenCalled();
		});

		it("lets a failed insert propagate so the transaction rolls the claim back", async () => {
			repository.claimSuccessNotificationInTx.mockResolvedValue(true);
			repository.findNotificationSubjectInTx.mockResolvedValue(SUBJECT);
			repository.insertSuccessNotificationInTx.mockRejectedValue(new Error("inbox down"));

			await expect(service.deliver("signup-referral-1")).rejects.toThrow("inbox down");
		});
	});

	describe("deliverAfterCheckout", () => {
		it("does nothing when the checkout stamped no referral", async () => {
			await service.deliverAfterCheckout(null);

			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("never fails the sale when delivery fails; the row stays owed for the retry", async () => {
			repository.claimSuccessNotificationInTx.mockRejectedValue(new Error("database blip"));

			await expect(service.deliverAfterCheckout("signup-referral-1")).resolves.toBeUndefined();
		});
	});

	describe("deliverPendingSuccessNotifications", () => {
		it("drains every page, steps past a failing row, and reports the counts", async () => {
			const firstPage = [
				{ id: "broken", successfulAt: BigInt(NOW - 2) },
				{ id: "ok-1", successfulAt: BigInt(NOW - 1) },
			];
			const secondPage = [{ id: "ok-2", successfulAt: BigInt(NOW) }];
			repository.listPendingSuccessNotifications.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage).mockResolvedValueOnce([]);
			repository.claimSuccessNotificationInTx.mockImplementation((_client: typeof tx, id: string): Promise<boolean> =>
				id === "broken" ? Promise.reject(new Error("bad row")) : Promise.resolve(true),
			);
			repository.findNotificationSubjectInTx.mockResolvedValue(SUBJECT);

			await expect(service.deliverPendingSuccessNotifications()).resolves.toEqual({ delivered: 2, failed: 1 });
			expect(repository.listPendingSuccessNotifications).toHaveBeenNthCalledWith(1, SIGNUP_REFERRAL_NOTIFY_PAGE_SIZE, null);
			expect(repository.listPendingSuccessNotifications).toHaveBeenNthCalledWith(2, SIGNUP_REFERRAL_NOTIFY_PAGE_SIZE, { id: "ok-1", successfulAt: BigInt(NOW - 1) });
			expect(repository.listPendingSuccessNotifications).toHaveBeenNthCalledWith(3, SIGNUP_REFERRAL_NOTIFY_PAGE_SIZE, { id: "ok-2", successfulAt: BigInt(NOW) });
		});
	});
});
