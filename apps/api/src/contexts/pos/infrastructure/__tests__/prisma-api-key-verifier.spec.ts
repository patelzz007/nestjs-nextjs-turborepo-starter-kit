import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { PrismaService } from "../../../../prisma/prisma.service";
import { OrganizationNotActiveError } from "../../domain/errors/pos.errors";
import { PrismaApiKeyVerifier } from "../adapters/prisma-api-key-verifier";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

/** The key columns the verifier selects. */
interface KeyRow {
	readonly id: string;
	readonly organizationId: string;
	readonly locationId: string | null;
	readonly scope: "POS" | "INTEGRATION";
	readonly terminal: { readonly id: string; readonly terminalId: string; readonly locationId: string; readonly isDeleted: boolean } | null;
}

/** The organization columns organizations' till facts read. */
interface OrganizationRow {
	readonly slug: string;
	readonly displayName: string;
	readonly lifecycleState: string;
	readonly isDeleted: boolean;
	readonly merchantProfile: { readonly requireRegisteredTerminals: boolean } | null;
}

interface FakeDatabase {
	readonly prisma: PrismaService;
	readonly findKey: Mock<(args: Prisma.OrganizationApiKeyFindFirstArgs) => Promise<KeyRow | null>>;
	readonly findOrganization: Mock<(args: Prisma.OrganizationFindUniqueArgs) => Promise<OrganizationRow | null>>;
	readonly touchKey: Mock<(args: Prisma.OrganizationApiKeyUpdateArgs) => Promise<object>>;
}

function database(): FakeDatabase {
	const findKey = vi
		.fn<(args: Prisma.OrganizationApiKeyFindFirstArgs) => Promise<KeyRow | null>>()
		.mockResolvedValue({ id: "key-1", organizationId: "org-1", locationId: null, scope: "INTEGRATION", terminal: null });
	const findOrganization = vi
		.fn<(args: Prisma.OrganizationFindUniqueArgs) => Promise<OrganizationRow | null>>()
		.mockResolvedValue({ slug: "brew-bean", displayName: "Brew & Bean", lifecycleState: "ACTIVE", isDeleted: false, merchantProfile: { requireRegisteredTerminals: true } });
	const touchKey = vi.fn<(args: Prisma.OrganizationApiKeyUpdateArgs) => Promise<object>>().mockResolvedValue({});
	const prisma = Object.assign(new PrismaService(createTestTypedConfig()), {
		organizationApiKey: { findFirst: findKey, update: touchKey },
		organization: { findUnique: findOrganization },
	});
	return { prisma, findKey, findOrganization, touchKey };
}

const CLOCK = new FixedClock(epochMs(1_800_000_000_000));

describe("PrismaApiKeyVerifier", () => {
	it("verifies a live key of an operating merchant by its sha256, records its last use and maps its scope's capabilities", async () => {
		const db = database();

		await expect(new PrismaApiKeyVerifier(db.prisma, CLOCK).verify("mk_live_x")).resolves.toEqual({
			provider: "merchant",
			apiKeyId: "key-1",
			organizationId: "org-1",
			locationId: null,
			terminal: null,
			requireRegisteredTerminals: true,
			scope: "INTEGRATION",
			capabilities: ["merchant:view_rewards", "merchant:manage_rewards", "merchant:view_redemptions", "merchant:view_analytics"],
		});
		expect(db.findKey.mock.calls.at(0)?.at(0)?.where).toEqual({ keyHash: createHash("sha256").update("mk_live_x").digest("hex"), isDeleted: false, revokedAt: null });
		expect(db.touchKey).toHaveBeenCalledWith({ where: { id: "key-1" }, data: { lastUsedAt: 1_800_000_000_000 }, select: { id: true } });
	});

	it("knows no unknown key, and no key whose paired till was removed", async () => {
		const db = database();
		db.findKey.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: "key-1",
			organizationId: "org-1",
			locationId: "store-a",
			scope: "POS",
			terminal: { id: "t-1", terminalId: "TERM-AAAA2222", locationId: "store-a", isDeleted: true },
		});
		const verifier = new PrismaApiKeyVerifier(db.prisma, CLOCK);

		await expect(verifier.verify("mk_live_x")).resolves.toBeNull();
		await expect(verifier.verify("mk_live_x")).resolves.toBeNull();
		expect(db.touchKey).not.toHaveBeenCalled();
	});

	it.each(["SUSPENDED", "RESTRICTED", "PROVISIONING", "PENDING_DELETION", "DELETED"])(
		"refuses every call with a %s merchant's key, without recording its use",
		async (lifecycleState) => {
			const db = database();
			db.findOrganization.mockResolvedValue({ slug: "brew-bean", displayName: "Brew & Bean", lifecycleState, isDeleted: false, merchantProfile: null });

			await expect(new PrismaApiKeyVerifier(db.prisma, CLOCK).verify("mk_live_x")).rejects.toBeInstanceOf(OrganizationNotActiveError);
			expect(db.touchKey).not.toHaveBeenCalled();
		},
	);

	it("refuses a soft-deleted organization's key even if its state still reads ACTIVE", async () => {
		const db = database();
		db.findOrganization.mockResolvedValue({ slug: "brew-bean", displayName: "Brew & Bean", lifecycleState: "ACTIVE", isDeleted: true, merchantProfile: null });

		await expect(new PrismaApiKeyVerifier(db.prisma, CLOCK).verify("mk_live_x")).rejects.toBeInstanceOf(OrganizationNotActiveError);
	});

	it("passes a paired till's terminal through", async () => {
		const db = database();
		db.findKey.mockResolvedValue({
			id: "key-1",
			organizationId: "org-1",
			locationId: "store-a",
			scope: "POS",
			terminal: { id: "t-1", terminalId: "TERM-AAAA2222", locationId: "store-a", isDeleted: false },
		});

		await expect(new PrismaApiKeyVerifier(db.prisma, CLOCK).verify("mk_live_x")).resolves.toMatchObject({
			terminal: { id: "t-1", terminalId: "TERM-AAAA2222", locationId: "store-a" },
			capabilities: [],
		});
	});
});
