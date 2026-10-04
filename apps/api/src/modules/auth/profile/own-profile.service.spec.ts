import { Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { epochMs, OWN_PROFILE_ERROR_CODES, type OwnProfile, type UpdateOwnProfileInput } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createAuditTrailDouble } from "../../../../test/support/audit-trail-double";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { RequestContextService } from "../../../common/context/request-context";
import { ConcurrentModificationError, ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import type { SystemDatabaseContext } from "../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { UserSessionCacheService } from "../cache/user-session-cache.service";
import { OwnProfileRepository, type OwnProfileChanges, type OwnProfileDbClient } from "./own-profile.repository";
import { ProfileUpdateDuringImpersonationError } from "./own-profile.errors";
import { OWN_PROFILE_UPDATE_OPERATION, OwnProfileService } from "./own-profile.service";
import { OwnProfileWritePolicy } from "./own-profile-write.policy";
import type { ProfileActor } from "./profile-actor";

const USER_ID = "7d3e9a10-2b4c-4d6e-8f01-23456789abcd";
const CREATED_AT_MS = 1_788_000_000_000;
const UPDATED_AT_MS = 1_788_253_200_000;
const CURRENT_VERSION = 2;

const SELF: ProfileActor = { kind: "self", userId: USER_ID };
const IMPERSONATED: ProfileActor = { kind: "impersonated", userId: USER_ID };

function storedProfile(): OwnProfile {
	return {
		id: USER_ID,
		email: "user@example.com",
		fullName: "Regular User",
		avatar: null,
		version: CURRENT_VERSION,
		createdAt: epochMs(CREATED_AT_MS),
		updatedAt: epochMs(UPDATED_AT_MS),
	};
}

/** The profile "table": one row, with the repository's compare-and-set semantics. */
class InMemoryProfiles extends OwnProfileRepository {
	public row: OwnProfile | null = storedProfile();
	public readonly writes: { readonly expectedVersion: number; readonly changes: OwnProfileChanges }[] = [];

	public override findLive(userId: string): Promise<OwnProfile | null> {
		return Promise.resolve(this.row?.id === userId ? this.row : null);
	}

	public override existsLive(userId: string): Promise<boolean> {
		return Promise.resolve(this.row?.id === userId);
	}

	public override updateIfVersionMatches(_tx: OwnProfileDbClient, userId: string, expectedVersion: number, changes: OwnProfileChanges): Promise<boolean> {
		this.writes.push({ expectedVersion, changes });
		if (this.row?.id !== userId || this.row.version !== expectedVersion) {
			return Promise.resolve(false);
		}
		this.row = { ...this.row, ...changes, version: this.row.version + 1 };
		return Promise.resolve(true);
	}
}

/** Runs the handler inline on a connection-less client and records the system operation it was opened under. */
class InlineTransactions extends TenantTransactionService {
	public readonly opened: SystemDatabaseContext[] = [];

	public override withSystemOperation<T>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		this.opened.push(context);
		return handler(createTestPrisma());
	}
}

interface Harness {
	readonly service: OwnProfileService;
	readonly profiles: InMemoryProfiles;
	readonly transactions: InlineTransactions;
	readonly recordInTransaction: MockInstance<AuditTrailService["recordInTransaction"]>;
	readonly invalidate: MockInstance<UserSessionCacheService["invalidate"]>;
}

function harness(): Harness {
	const requestContext = new RequestContextService();
	const prisma = createTestPrisma();
	const profiles = new InMemoryProfiles(prisma);
	const transactions = new InlineTransactions(prisma, requestContext);
	const { auditTrail } = createAuditTrailDouble(requestContext);
	const recordInTransaction = vi.spyOn(auditTrail, "recordInTransaction").mockResolvedValue();
	const sessionCache = new UserSessionCacheService(createTestTypedConfig());
	const invalidate = vi.spyOn(sessionCache, "invalidate");
	return {
		service: new OwnProfileService(profiles, new OwnProfileWritePolicy(), transactions, auditTrail, sessionCache),
		profiles,
		transactions,
		recordInTransaction,
		invalidate,
	};
}

const RENAME: UpdateOwnProfileInput = { version: CURRENT_VERSION, fullName: "Jane Doe" };

describe("OwnProfileService", () => {
	let errorLog: MockInstance<Logger["error"]>;

	beforeEach(() => {
		errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getOwnProfile", () => {
		it("returns the caller's own profile", async () => {
			await expect(harness().service.getOwnProfile(SELF)).resolves.toEqual(storedProfile());
		});

		it("lets an impersonation session read the impersonated user's profile", async () => {
			await expect(harness().service.getOwnProfile(IMPERSONATED)).resolves.toEqual(storedProfile());
		});

		it("answers 404 when the account no longer exists", async () => {
			const { service, profiles } = harness();
			profiles.row = null;

			await expect(service.getOwnProfile(SELF)).rejects.toBeInstanceOf(ResourceNotFoundError);
		});
	});

	describe("updateOwnProfile", () => {
		it("applies the change at the expected version, under auth.profile.update, and returns the new version", async () => {
			const { service, profiles, transactions } = harness();

			const updated = await service.updateOwnProfile(SELF, RENAME);

			expect(updated).toEqual({ ...storedProfile(), fullName: "Jane Doe", version: CURRENT_VERSION + 1 });
			expect(profiles.writes).toEqual([{ expectedVersion: CURRENT_VERSION, changes: { fullName: "Jane Doe" } }]);
			expect(transactions.opened).toEqual([{ operation: OWN_PROFILE_UPDATE_OPERATION, reason: "User edits their own profile", actorUserId: USER_ID }]);
		});

		it("records the request's audit row inside the same transaction, with the profile it returns", async () => {
			const { service, recordInTransaction } = harness();

			const updated = await service.updateOwnProfile(SELF, RENAME);

			expect(recordInTransaction).toHaveBeenCalledTimes(1);
			expect(recordInTransaction).toHaveBeenCalledWith(expect.anything(), updated);
		});

		it("drops the cached /auth/me payload (it carries the name) after the change committed", async () => {
			const { service, invalidate } = harness();

			await service.updateOwnProfile(SELF, RENAME);

			expect(invalidate).toHaveBeenCalledWith(USER_ID);
		});

		it("refuses an impersonation session with 403 before opening any transaction", async () => {
			const { service, profiles, transactions, recordInTransaction, invalidate } = harness();

			const attempt = service.updateOwnProfile(IMPERSONATED, RENAME);

			await expect(attempt).rejects.toBeInstanceOf(ProfileUpdateDuringImpersonationError);
			await expect(attempt).rejects.toMatchObject({ code: OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION, httpStatus: 403 });
			expect(transactions.opened).toEqual([]);
			expect(profiles.writes).toEqual([]);
			expect(recordInTransaction).not.toHaveBeenCalled();
			expect(invalidate).not.toHaveBeenCalled();
			expect(profiles.row?.fullName).toBe("Regular User");
		});

		it("answers 409 when the profile changed since the client read it (stale version), writing nothing", async () => {
			const { service, profiles, recordInTransaction, invalidate } = harness();

			await expect(service.updateOwnProfile(SELF, { ...RENAME, version: CURRENT_VERSION - 1 })).rejects.toBeInstanceOf(ConcurrentModificationError);

			expect(profiles.row).toEqual(storedProfile());
			expect(recordInTransaction).not.toHaveBeenCalled();
			expect(invalidate).not.toHaveBeenCalled();
		});

		it("lets exactly one of two edits based on the same version win", async () => {
			const { service } = harness();

			const results = await Promise.allSettled([service.updateOwnProfile(SELF, RENAME), service.updateOwnProfile(SELF, { ...RENAME, fullName: "John Roe" })]);

			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			const rejected = results.find((result) => result.status === "rejected");
			expect(rejected?.status === "rejected" ? rejected.reason : null).toBeInstanceOf(ConcurrentModificationError);
		});

		it("answers 404 (not 409) when the account vanished", async () => {
			const { service, profiles } = harness();
			profiles.row = null;

			await expect(service.updateOwnProfile(SELF, RENAME)).rejects.toBeInstanceOf(ResourceNotFoundError);
		});

		it("still reports the committed change when the session cache cannot be cleared, and logs the failure", async () => {
			const { service, invalidate } = harness();
			invalidate.mockRejectedValueOnce(new Error("redis down"));

			await expect(service.updateOwnProfile(SELF, RENAME)).resolves.toMatchObject({ fullName: "Jane Doe", version: CURRENT_VERSION + 1 });

			expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ event: "profile.session_cache_invalidation_failed", userId: USER_ID, error: "redis down" }));
		});
	});
});
