import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import { SessionUserRepository } from "../../sessions/repositories/session-user.repository";

import { UserSessionRevocationService } from "./user-session-revocation.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	revokeAllForUsers: vi.fn(),
	bumpTokenVersions: vi.fn(),
	invalidate: vi.fn(),
	steps: new Array<string>(),
	transactionClient: { label: "tx" },
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		/** Runs the unit of work with a sentinel client; a throw propagates like a ROLLBACK. */
		public async $transaction<T>(work: (tx: { readonly label: string }) => Promise<T>): Promise<T> {
			mocks.steps.push("begin");
			const result = await work(mocks.transactionClient);
			mocks.steps.push("commit");
			return result;
		}
	},
}));

vi.mock("../../sessions/repositories/refresh-token.repository", () => ({
	RefreshTokenRepository: class {
		public readonly revokeAllForUsers = mocks.revokeAllForUsers;
	},
}));

vi.mock("../../sessions/repositories/session-user.repository", () => ({
	SessionUserRepository: class {
		public readonly bumpTokenVersions = mocks.bumpTokenVersions;
	},
}));

vi.mock("../../auth/services/access-token-state.service", () => ({
	AccessTokenStateService: class {
		public readonly invalidate = mocks.invalidate;
	},
}));

function createService(): UserSessionRevocationService {
	const config = createTestTypedConfig();
	const prisma = new PrismaService(config);
	return new UserSessionRevocationService(prisma, new RefreshTokenRepository(prisma), new SessionUserRepository(prisma), new AccessTokenStateService(prisma, config));
}

describe("UserSessionRevocationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.steps.length = 0;
		mocks.revokeAllForUsers.mockResolvedValue(undefined);
		mocks.bumpTokenVersions.mockResolvedValue(undefined);
		mocks.invalidate.mockImplementation((): void => {
			mocks.steps.push("invalidate");
		});
	});

	it("revokes refresh tokens and bumps tokenVersion in one transaction, then invalidates the access-token cache", async () => {
		await createService().revokeAllSessionsForUsers(["user-1", "user-1"]);

		expect(mocks.revokeAllForUsers).toHaveBeenCalledWith(["user-1"], mocks.transactionClient);
		expect(mocks.bumpTokenVersions).toHaveBeenCalledWith(["user-1"], mocks.transactionClient);
		expect(mocks.invalidate).toHaveBeenCalledWith("user-1");
		expect(mocks.steps).toEqual(["begin", "commit", "invalidate"]);
	});

	it("runs the caller's same-transaction write (e.g. an outbox event) inside the revocation transaction", async () => {
		const withinTransaction = vi.fn(async (): Promise<void> => {
			mocks.steps.push("event");
			return Promise.resolve();
		});

		await createService().revokeAllSessionsForUser("user-1", withinTransaction);

		expect(withinTransaction).toHaveBeenCalledWith(mocks.transactionClient);
		expect(mocks.steps).toEqual(["begin", "event", "commit", "invalidate"]);
	});

	it("does not invalidate the cache when the transaction fails", async () => {
		mocks.bumpTokenVersions.mockRejectedValue(new Error("deadlock detected"));

		await expect(createService().revokeAllSessionsForUser("user-1")).rejects.toThrow("deadlock detected");

		expect(mocks.invalidate).not.toHaveBeenCalled();
	});

	it("no-ops when userIds is empty", async () => {
		await createService().revokeAllSessionsForUsers([]);

		expect(mocks.revokeAllForUsers).not.toHaveBeenCalled();
		expect(mocks.bumpTokenVersions).not.toHaveBeenCalled();
		expect(mocks.invalidate).not.toHaveBeenCalled();
		expect(mocks.steps).toEqual([]);
	});
});
