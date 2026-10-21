import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { IDENTITY_REFEREE_ATTRIBUTION_FACTORY } from "../referee-attribution.adapter";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);
const EXPIRES_AT = epochMs(1_800_600_000_000);
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

describe("IDENTITY_REFEREE_ATTRIBUTION_FACTORY", () => {
	it("stores the token and its expiry on the live user, on the caller's transaction", async () => {
		const updateMany = vi.fn<(args: Prisma.UserUpdateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 1 });
		const tx = Object.assign(new PrismaService(createTestTypedConfig()), { user: { updateMany } });

		expect(await IDENTITY_REFEREE_ATTRIBUTION_FACTORY.forTransaction(tx).setPending("user-1", TOKEN, EXPIRES_AT, NOW)).toBe(true);
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "user-1", isDeleted: false },
			data: { pendingAttributionToken: TOKEN, pendingAttributionExpiresAt: EXPIRES_AT, updatedAt: NOW, updatedBy: "user-1" },
		});
	});

	it("reports a user who is gone", async () => {
		const updateMany = vi.fn<(args: Prisma.UserUpdateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 0 });
		const tx = Object.assign(new PrismaService(createTestTypedConfig()), { user: { updateMany } });

		expect(await IDENTITY_REFEREE_ATTRIBUTION_FACTORY.forTransaction(tx).setPending("gone", TOKEN, EXPIRES_AT, NOW)).toBe(false);
	});
});
