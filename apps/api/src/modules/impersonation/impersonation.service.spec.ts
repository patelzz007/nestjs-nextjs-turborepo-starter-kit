import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../common/context/request-context";
import { PlatformOutboxService } from "../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { LogService } from "../logs/logs.service";
import { AuthorizationCacheService } from "../authorization/cache/authorization-cache.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { TokenService } from "../auth/services/token.service";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { ImpersonationService } from "./impersonation.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

interface AuditRow {
	readonly action: string;
}

/**
 * Shared state for the fake Prisma client. Audit rows written through
 * `$transaction` are only committed when the unit of work resolves; a throw
 * discards them — the same all-or-nothing contract Postgres gives.
 */
const state = vi.hoisted(() => ({
	committedAudit: new Array<AuditRow>(),
	transactionClients: new Array<{ readonly id: number }>(),
	users: new Map<string, { readonly id: string; readonly isSuperAdmin: boolean; readonly isActive: boolean; readonly isDeleted: boolean; readonly email: string }>(),
	enqueueInTransaction: vi.fn<PlatformOutboxService["enqueueInTransaction"]>(),
}));

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = {
			findUnique: async (args: { readonly where: { readonly id: string } }): Promise<object | null> => Promise.resolve(state.users.get(args.where.id) ?? null),
		};

		public async $transaction<T>(work: (tx: object) => Promise<T>): Promise<T> {
			const staged: AuditRow[] = [];
			const tx = {
				id: state.transactionClients.length + 1,
				impersonationAuditLog: {
					create: async (args: { readonly data: AuditRow }): Promise<object> => {
						staged.push({ action: args.data.action });
						return Promise.resolve({});
					},
				},
			};
			state.transactionClients.push(tx);
			const result = await work(tx);
			state.committedAudit.push(...staged);
			return result;
		}
	},
}));

vi.mock("../../infrastructure/outbox/platform-outbox.service", () => ({
	PlatformOutboxService: class {
		public readonly enqueueInTransaction = state.enqueueInTransaction;
	},
}));

vi.mock("../auth/services/token.service", () => ({
	TokenService: class {
		public readonly generateImpersonationToken = async (): Promise<string> => Promise.resolve("impersonation-token");
		public readonly generateAccessToken = async (): Promise<string> => Promise.resolve("admin-token");
	},
}));

vi.mock("../authorization/services/authorization-checker.service", () => ({
	AuthorizationCheckerService: class {
		public readonly getUserPermissionDetails = async (): Promise<{ readonly roles: string[]; readonly permissions: string[] }> =>
			Promise.resolve({ roles: [], permissions: [] });
	},
}));

vi.mock("../auth/services/user-response.mapper", () => ({
	UserResponseMapper: class {
		public readonly toFlatUser = (): object => ({ id: "flat" });
		public readonly build = (): object => ({ id: "profile" });
	},
}));

vi.mock("../logs/logs.service", () => ({
	LogService: class {
		public readonly warn = (): void => undefined;
	},
}));

const ADMIN_ID = "admin-1";
const TARGET_ID = "target-1";

function createService(): ImpersonationService {
	const config = createTestTypedConfig();
	const prisma = new PrismaService(config);
	return new ImpersonationService(
		prisma,
		new TokenService(new JwtService(), config),
		new AuthorizationCheckerService(new AuthorizationCacheService(config), prisma),
		new LogService(config, new RequestContextService()),
		new UserResponseMapper(),
		new PlatformOutboxService(new TenantTransactionService(prisma), new RequestContextService()),
	);
}

describe("ImpersonationService (transactional outbox)", () => {
	beforeEach(() => {
		state.committedAudit.length = 0;
		state.transactionClients.length = 0;
		state.enqueueInTransaction.mockReset();
		state.enqueueInTransaction.mockResolvedValue("evt-1");
		state.users.clear();
		state.users.set(ADMIN_ID, { id: ADMIN_ID, isSuperAdmin: true, isActive: true, isDeleted: false, email: "admin@example.com" });
		state.users.set(TARGET_ID, { id: TARGET_ID, isSuperAdmin: false, isActive: true, isDeleted: false, email: "target@example.com" });
	});

	it("writes the START audit row and the impersonation.action event in one transaction", async () => {
		await createService().impersonateUser(ADMIN_ID, TARGET_ID);

		expect(state.committedAudit).toEqual([{ action: "START" }]);
		expect(state.enqueueInTransaction).toHaveBeenCalledTimes(1);
		expect(state.enqueueInTransaction.mock.lastCall?.[0]).toBe(state.transactionClients[0]);
		expect(state.enqueueInTransaction.mock.lastCall?.[1]).toMatchObject({
			type: "impersonation.action",
			payload: { action: "start", superAdminId: ADMIN_ID, targetUserId: TARGET_ID, status: "succeeded" },
		});
	});

	it("rolls the audit row back when the event cannot be written", async () => {
		state.enqueueInTransaction.mockRejectedValue(new Error("outbox insert failed"));

		await expect(createService().impersonateUser(ADMIN_ID, TARGET_ID)).rejects.toThrow("outbox insert failed");

		expect(state.committedAudit).toEqual([]);
	});

	it("writes no audit row and no event when the impersonator is not a super admin", async () => {
		await expect(createService().impersonateUser(TARGET_ID, ADMIN_ID)).rejects.toThrow("Only super administrators can impersonate users");

		expect(state.committedAudit).toEqual([]);
		expect(state.enqueueInTransaction).not.toHaveBeenCalled();
	});

	it("writes the STOP audit row and its event in one transaction", async () => {
		await createService().stopImpersonation(ADMIN_ID, TARGET_ID);

		expect(state.committedAudit).toEqual([{ action: "STOP" }]);
		expect(state.enqueueInTransaction).toHaveBeenCalledTimes(1);
		expect(state.enqueueInTransaction.mock.lastCall?.[0]).toBe(state.transactionClients[0]);
		expect(state.enqueueInTransaction.mock.lastCall?.[1]).toMatchObject({ payload: { action: "stop", superAdminId: ADMIN_ID, targetUserId: TARGET_ID } });
	});
});
