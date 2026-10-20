import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { createTenantsTransactionalPorts } from "../tenants-transactional-ports";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);

interface TenantRow {
	readonly slug: string;
	readonly displayName: string;
	readonly lifecycleState: string;
	readonly isDeleted: boolean;
	readonly merchantProfile: { readonly requireRegisteredTerminals: boolean } | null;
}

interface FakeDatabase {
	readonly prisma: PrismaService;
	readonly findTenant: Mock<(args: Prisma.TenantFindUniqueArgs) => Promise<TenantRow | null>>;
	readonly findLocations: Mock<(args: Prisma.LocationFindManyArgs) => Promise<readonly { readonly id: string; readonly name: string }[]>>;
	readonly findProfile: Mock<(args: Prisma.TenantMerchantProfileFindUniqueArgs) => Promise<{ readonly requireRegisteredTerminals: boolean } | null>>;
	readonly updateProfiles: Mock<(args: Prisma.TenantMerchantProfileUpdateManyArgs) => Promise<Prisma.BatchPayload>>;
	readonly queryRaw: Mock<(query: TemplateStringsArray, ...values: readonly string[]) => Promise<readonly { readonly id: string }[]>>;
}

function database(): FakeDatabase {
	const findTenant = vi
		.fn<(args: Prisma.TenantFindUniqueArgs) => Promise<TenantRow | null>>()
		.mockResolvedValue({ slug: "brew-bean", displayName: "Brew & Bean", lifecycleState: "ACTIVE", isDeleted: false, merchantProfile: { requireRegisteredTerminals: true } });
	const findLocations = vi
		.fn<(args: Prisma.LocationFindManyArgs) => Promise<readonly { readonly id: string; readonly name: string }[]>>()
		.mockResolvedValue([{ id: "store-a", name: "Store A" }]);
	const findProfile = vi
		.fn<(args: Prisma.TenantMerchantProfileFindUniqueArgs) => Promise<{ readonly requireRegisteredTerminals: boolean } | null>>()
		.mockResolvedValue({ requireRegisteredTerminals: false });
	const updateProfiles = vi.fn<(args: Prisma.TenantMerchantProfileUpdateManyArgs) => Promise<Prisma.BatchPayload>>().mockResolvedValue({ count: 1 });
	const queryRaw = vi.fn<(query: TemplateStringsArray, ...values: readonly string[]) => Promise<readonly { readonly id: string }[]>>().mockResolvedValue([{ id: "store-a" }]);
	const prisma = Object.assign(new PrismaService(createTestTypedConfig()), {
		$queryRaw: queryRaw,
		tenant: { findUnique: findTenant },
		location: { findMany: findLocations },
		tenantMerchantProfile: { findUnique: findProfile, updateMany: updateProfiles },
	});
	return { prisma, findTenant, findLocations, findProfile, updateProfiles, queryRaw };
}

describe("createTenantsTransactionalPorts().merchantPosSettings", () => {
	it("tells a till its tenant's name, whether it operates, and its terminal policy", async () => {
		const db = database();
		const settings = createTenantsTransactionalPorts(db.prisma).merchantPosSettings;

		await expect(settings.tillTenant("org-1")).resolves.toEqual({ slug: "brew-bean", displayName: "Brew & Bean", operating: true, requireRegisteredTerminals: true });
		db.findTenant.mockResolvedValueOnce({ slug: "brew-bean", displayName: "Brew & Bean", lifecycleState: "SUSPENDED", isDeleted: false, merchantProfile: null });
		await expect(settings.tillTenant("org-1")).resolves.toMatchObject({ operating: false, requireRegisteredTerminals: false });
		db.findTenant.mockResolvedValueOnce(null);
		await expect(settings.tillTenant("org-1")).resolves.toBeNull();
	});

	it("names the stores in one read, and reads nothing for no stores", async () => {
		const db = database();
		const settings = createTenantsTransactionalPorts(db.prisma).merchantPosSettings;

		await expect(settings.storeNames(["store-a", "store-a"])).resolves.toEqual(new Map([["store-a", "Store A"]]));
		await expect(settings.storeNames([])).resolves.toEqual(new Map());
		expect(db.findLocations).toHaveBeenCalledOnce();
		expect(db.findLocations.mock.calls.at(0)?.at(0)?.where).toEqual({ id: { in: ["store-a"] } });
	});

	it("reads and writes the terminal policy at the caller's time, answering a missing profile", async () => {
		const db = database();
		const settings = createTenantsTransactionalPorts(db.prisma).merchantPosSettings;

		await expect(settings.requireRegisteredTerminals("org-1")).resolves.toBe(false);
		await expect(settings.setRequireRegisteredTerminals("org-1", true, NOW)).resolves.toBe(true);
		expect(db.updateProfiles).toHaveBeenCalledWith({ where: { tenantId: "org-1" }, data: { requireRegisteredTerminals: true, updatedAt: BigInt(NOW) } });
		db.findProfile.mockResolvedValueOnce(null);
		db.updateProfiles.mockResolvedValueOnce({ count: 0 });
		await expect(settings.requireRegisteredTerminals("org-1")).resolves.toBeNull();
		await expect(settings.setRequireRegisteredTerminals("org-1", true, NOW)).resolves.toBe(false);
	});

	it("locks an open store FOR SHARE and says whether it is still open", async () => {
		const db = database();
		const settings = createTenantsTransactionalPorts(db.prisma).merchantPosSettings;

		await expect(settings.lockOpenStore("org-1", "store-a")).resolves.toBe(true);
		const [strings, ...values] = db.queryRaw.mock.calls.at(0) ?? [];
		expect(strings?.join("?").replace(/\s+/gu, " ")).toMatch(/"isDeleted" = false AND status <> 'INACTIVE' FOR SHARE$/u);
		expect(values).toEqual(["store-a", "org-1"]);
		db.queryRaw.mockResolvedValueOnce([]);
		await expect(settings.lockOpenStore("org-1", "store-closed")).resolves.toBe(false);
	});
});
