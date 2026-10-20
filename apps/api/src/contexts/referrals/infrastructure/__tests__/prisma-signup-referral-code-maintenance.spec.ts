import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import type { IssuedSignupReferralCode, SignupReferralAuditPort } from "../../application/ports/signup-referral-audit.port";
import { PrismaSignupReferralCodeMaintenance, type SignupReferralAuditFactory, type SystemOperationTransactions } from "../persistence/prisma-signup-referral-jobs";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;

type FindUser = (args: Prisma.UserFindUniqueArgs) => Promise<{ readonly isDeleted: boolean; readonly signupReferralCodes: readonly { readonly expiresAt: bigint }[] } | null>;
type CreateCodes = (args: Prisma.SignupReferralCodeCreateManyArgs) => Promise<Prisma.BatchPayload>;

/** Runs every system operation on the fake client, recording its name. */
class RecordingTransactions implements SystemOperationTransactions {
	public readonly operations: string[] = [];

	public constructor(private readonly tx: Prisma.TransactionClient) {}

	public withSystemOperation<T>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		this.operations.push(context.operation);
		return handler(this.tx);
	}
}

/** Records what the code job audited, on which transaction. */
class RecordingAudit implements SignupReferralAuditFactory {
	public readonly recorded: { readonly db: Prisma.TransactionClient; readonly issued: IssuedSignupReferralCode }[] = [];

	public forTransaction(db: Prisma.TransactionClient): SignupReferralAuditPort {
		return {
			recordCodeIssued: (issued: IssuedSignupReferralCode): Promise<void> => {
				this.recorded.push({ db, issued });
				return Promise.resolve();
			},
		};
	}
}

function database(user: Awaited<ReturnType<FindUser>>): { readonly tx: PrismaService; readonly locked: Mock<() => Promise<number>>; readonly createCodes: Mock<CreateCodes> } {
	const locked = vi.fn<() => Promise<number>>().mockResolvedValue(1);
	const createCodes = vi.fn<CreateCodes>().mockResolvedValue({ count: 1 });
	const tx = Object.assign(new PrismaService(createTestTypedConfig()), {
		$executeRaw: locked,
		user: { findUnique: vi.fn<FindUser>().mockResolvedValue(user) },
		signupReferralCode: { createMany: createCodes },
	});
	return { tx, locked, createCodes };
}

describe("PrismaSignupReferralCodeMaintenance.issueCodeIfDue", () => {
	it("issues a first code under the user's lock and audits it through rewards' writer on the same transaction", async () => {
		const db = database({ isDeleted: false, signupReferralCodes: [] });
		const transactions = new RecordingTransactions(db.tx);
		const audit = new RecordingAudit();

		await expect(new PrismaSignupReferralCodeMaintenance(transactions, audit).issueCodeIfDue("user-1", NOW)).resolves.toBe("first");

		expect(transactions.operations).toEqual(["maintenance.signup_referral_codes"]);
		expect(db.createCodes).toHaveBeenCalledOnce();
		expect(db.createCodes.mock.calls.at(0)?.at(0)?.data).toEqual([expect.objectContaining({ userId: "user-1" })]);
		const [inserted] = [db.createCodes.mock.calls.at(0)?.at(0)?.data].flat();
		expect(audit.recorded).toEqual([{ db: db.tx, issued: { ownerUserId: "user-1", referralCodeId: inserted?.id, successor: false } }]);
	});

	it("issues a successor for an expired code, and nothing (no audit) for a user with a live code or no row", async () => {
		const expired = database({ isDeleted: false, signupReferralCodes: [{ expiresAt: BigInt(NOW - 1) }] });
		const audit = new RecordingAudit();
		await expect(new PrismaSignupReferralCodeMaintenance(new RecordingTransactions(expired.tx), audit).issueCodeIfDue("user-1", NOW)).resolves.toBe("successor");
		expect(audit.recorded.map((entry) => entry.issued.successor)).toEqual([true]);

		const live = database({ isDeleted: false, signupReferralCodes: [{ expiresAt: BigInt(NOW + 1) }] });
		const gone = database(null);
		gone.locked.mockResolvedValue(0);
		const quiet = new RecordingAudit();
		await expect(new PrismaSignupReferralCodeMaintenance(new RecordingTransactions(live.tx), quiet).issueCodeIfDue("user-1", NOW)).resolves.toBe("skipped");
		await expect(new PrismaSignupReferralCodeMaintenance(new RecordingTransactions(gone.tx), quiet).issueCodeIfDue("user-1", NOW)).resolves.toBe("skipped");
		expect(quiet.recorded).toEqual([]);
		expect(live.createCodes).not.toHaveBeenCalled();
	});
});
