import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { RewardUserRepository } from "./reward-user.repository";

const USER_ID = "7d3e9a10-2b4c-4d6e-8f01-23456789abcd";
/** `Date.now()` during each test — the `updatedAt` every write stamps. */
const FROZEN_NOW_MS = 1_790_000_000_000;

const mocks = vi.hoisted((): { readonly updateArgs: object[] } => ({ updateArgs: [] }));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = {
			update: (args: object): Promise<object> => {
				mocks.updateArgs.push(args);
				return Promise.resolve({});
			},
		};
	},
}));

function repository(): RewardUserRepository {
	return new RewardUserRepository(new PrismaService(createTestTypedConfig()));
}

/**
 * Every write of a self-service profile field must move `profileVersion`, the
 * optimistic-lock token of `PATCH /auth/profile`: otherwise a profile edit
 * based on the old version would silently overwrite this change.
 */
describe("RewardUserRepository — profile-field writes move the profile version", () => {
	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(FROZEN_NOW_MS);
		mocks.updateArgs.length = 0;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("updateFullName increments profileVersion with the new name", async () => {
		await repository().updateFullName(USER_ID, "Jane Doe");

		expect(mocks.updateArgs).toEqual([{ where: { id: USER_ID }, data: { fullName: "Jane Doe", profileVersion: { increment: 1 }, updatedAt: FROZEN_NOW_MS } }]);
	});

	it("updateCredentials increments profileVersion with the new name", async () => {
		await repository().updateCredentials(USER_ID, { passwordHash: "hash", fullName: "Jane Doe" });

		expect(mocks.updateArgs).toEqual([
			{
				where: { id: USER_ID },
				data: { passwordHash: "hash", fullName: "Jane Doe", profileVersion: { increment: 1 }, updatedAt: FROZEN_NOW_MS },
			},
		]);
	});
});
