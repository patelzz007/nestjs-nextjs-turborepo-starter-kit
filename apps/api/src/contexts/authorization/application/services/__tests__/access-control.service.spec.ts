import { describe, expect, it } from "vitest";
import { epochMs, type PermissionPair } from "@workspace/shared";

import type { AccessFacts } from "../../../domain/access/access-facts";
import { StoreScope } from "../../../domain/access/store-scope";
import { AccessDeniedError } from "../../../domain/errors/authorization.errors";
import { FixedClock, NOW } from "../../__tests__/fakes/authorization.fakes";
import type { AccessFactsReader } from "../../ports/access-facts.port";
import { AccessControlService } from "../access-control.service";

const READ_REWARD: PermissionPair = { action: "READ", resource: "REWARD" };
const READ_ANALYTICS: PermissionPair = { action: "READ", resource: "ANALYTICS" };
const BAN_CUSTOMER: PermissionPair = { action: "CREATE", resource: "CUSTOMER_BAN" };
const HOUR_MS = 3_600_000;

/** A fixed standing per call, recording which tenant it was asked about. */
class FixedStanding implements AccessFactsReader {
	public readonly asked: (string | undefined)[] = [];

	public constructor(private readonly facts: AccessFacts | null) {}

	public read(_userId: string, tenantId: string | undefined): Promise<AccessFacts | null> {
		this.asked.push(tenantId);
		return Promise.resolve(this.facts);
	}
}

function standing(overrides: Partial<AccessFacts> = {}): FixedStanding {
	return new FixedStanding({ rolePermissions: [], stores: StoreScope.all(), grants: [], shares: [], ...overrides });
}

function service(reader: AccessFactsReader, owner: string | null = null): AccessControlService {
	return new AccessControlService(reader, { ownerOf: (): Promise<string | null> => Promise.resolve(owner) }, new FixedClock());
}

describe("AccessControlService", () => {
	it("decides with the caller's standing in the asked tenant, naming the path", async () => {
		const reader = standing({ rolePermissions: [READ_REWARD] });

		await expect(service(reader).decide({ userId: "u", tenantId: "t", permission: READ_REWARD })).resolves.toEqual({ allowed: true, path: "role" });
		expect(reader.asked).toEqual(["t"]);
	});

	it("denies a caller with no standing (no active membership, no support access)", async () => {
		await expect(service(new FixedStanding(null)).decide({ userId: "u", tenantId: "t", permission: READ_REWARD })).resolves.toEqual({ allowed: false, path: null });
	});

	it("lets ownership decide a record with no role behind it", async () => {
		await expect(
			service(standing(), "u").decide({ userId: "u", permission: { action: "READ", resource: "PROFILE" }, target: { resource: "PROFILE", resourceId: "p" } }),
		).resolves.toEqual({
			allowed: true,
			path: "ownership",
		});
	});

	it("require() returns the allow path, or throws the uniform 403", async () => {
		await expect(service(standing({ rolePermissions: [READ_REWARD] })).require({ userId: "u", tenantId: "t", permission: READ_REWARD })).resolves.toMatchObject({
			path: "role",
		});
		await expect(service(standing()).require({ userId: "u", tenantId: "t", permission: READ_REWARD })).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("lists the role's permissions plus live grants only — an expired grant is gone", async () => {
		const reader = standing({
			rolePermissions: [READ_REWARD],
			grants: [
				{ permission: READ_ANALYTICS, locationId: null, expiresAt: epochMs(NOW + 48 * HOUR_MS) },
				{ permission: BAN_CUSTOMER, locationId: null, expiresAt: epochMs(NOW - HOUR_MS) },
			],
		});

		await expect(service(reader).effectivePermissions("u", "t")).resolves.toEqual([READ_REWARD, READ_ANALYTICS]);
		await expect(service(new FixedStanding(null)).effectivePermissions("u", "t")).resolves.toEqual([]);
	});
});
