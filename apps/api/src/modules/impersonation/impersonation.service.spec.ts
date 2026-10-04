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
import { ImpersonationSessionRepository } from "../auth/repositories/impersonation-session.repository";
import { ImpersonationService } from "./impersonation.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

interface AuditRow {
	readonly action: string;
	readonly impersonatorId: string;
	readonly sessionId: string | null;
}

interface SessionRow {
	readonly id: string;
	readonly impersonatorId: string;
	readonly targetUserId: string;
	readonly expiresAt: number;
	endedAt: number | null;
	endedBy: string | null;
}

interface UserRow {
	readonly id: string;
	readonly isSuperAdmin: boolean;
	readonly isActive: boolean;
	readonly isDeleted: boolean;
	readonly email: string;
}

interface UpdateManyArgs {
	readonly where: { readonly id: string; readonly impersonatorId: string; readonly targetUserId: string; readonly endedAt: null };
	readonly data: { readonly endedAt: number; readonly endedBy: string };
}

/**
 * Shared state for the fake Prisma client. Audit rows and session writes made
 * through `$transaction` are only committed when the unit of work resolves; a
 * throw discards them — the same all-or-nothing contract Postgres gives.
 */
const state = vi.hoisted(() => ({
	committedAudit: new Array<AuditRow>(),
	sessions: new Map<string, SessionRow>(),
	transactionClients: new Array<{ readonly id: number }>(),
	users: new Map<string, UserRow>(),
	enqueueInTransaction: vi.fn<PlatformOutboxService["enqueueInTransaction"]>(),
	generateImpersonationToken: vi.fn<(user: object, originalUserId: string, sessionId: string) => Promise<string>>(),
}));

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = {
			findUnique: async (args: { readonly where: { readonly id: string } }): Promise<object | null> => Promise.resolve(state.users.get(args.where.id) ?? null),
		};

		public async $transaction<T>(work: (tx: object) => Promise<T>): Promise<T> {
			const stagedAudit: AuditRow[] = [];
			const stagedSessions = new Map<string, SessionRow>();
			const stagedEnds = new Array<{ readonly id: string; readonly endedAt: number; readonly endedBy: string }>();
			const tx = {
				id: state.transactionClients.length + 1,
				impersonationAuditLog: {
					create: async (args: { readonly data: AuditRow }): Promise<object> => {
						stagedAudit.push({ action: args.data.action, impersonatorId: args.data.impersonatorId, sessionId: args.data.sessionId });
						return Promise.resolve({});
					},
				},
				impersonationSession: {
					create: async (args: { readonly data: Omit<SessionRow, "id" | "endedAt" | "endedBy"> }): Promise<{ readonly id: string }> => {
						const id = `session-${String(state.sessions.size + stagedSessions.size + 1)}`;
						stagedSessions.set(id, { ...args.data, id, endedAt: null, endedBy: null });
						return Promise.resolve({ id });
					},
					updateMany: async (args: UpdateManyArgs): Promise<{ readonly count: number }> => {
						const row = state.sessions.get(args.where.id);
						const matches = row?.impersonatorId === args.where.impersonatorId && row.targetUserId === args.where.targetUserId && row.endedAt === null;
						if (matches) {
							stagedEnds.push({ id: args.where.id, endedAt: args.data.endedAt, endedBy: args.data.endedBy });
						}
						return Promise.resolve({ count: matches ? 1 : 0 });
					},
				},
			};
			state.transactionClients.push(tx);
			const result = await work(tx);
			state.committedAudit.push(...stagedAudit);
			for (const [id, row] of stagedSessions) {
				state.sessions.set(id, row);
			}
			for (const end of stagedEnds) {
				const row = state.sessions.get(end.id);
				if (row !== undefined) {
					row.endedAt = end.endedAt;
					row.endedBy = end.endedBy;
				}
			}
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
		public readonly generateImpersonationToken = state.generateImpersonationToken;
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
		new ImpersonationSessionRepository(prisma),
		new TokenService(new JwtService(), config),
		new AuthorizationCheckerService(new AuthorizationCacheService(config), prisma),
		new LogService(new RequestContextService()),
		new UserResponseMapper(),
		new PlatformOutboxService(new TenantTransactionService(prisma, new RequestContextService()), new RequestContextService()),
	);
}

/** A live session for ADMIN_ID → TARGET_ID, as `impersonateUser` would have committed it. */
function seedLiveSession(): string {
	const id = "session-live";
	state.sessions.set(id, { id, impersonatorId: ADMIN_ID, targetUserId: TARGET_ID, expiresAt: Date.now() + 60_000, endedAt: null, endedBy: null });
	return id;
}

describe("ImpersonationService", () => {
	beforeEach(() => {
		state.committedAudit.length = 0;
		state.transactionClients.length = 0;
		state.sessions.clear();
		state.enqueueInTransaction.mockReset();
		state.enqueueInTransaction.mockResolvedValue("evt-1");
		state.generateImpersonationToken.mockReset();
		state.generateImpersonationToken.mockResolvedValue("impersonation-token");
		state.users.clear();
		state.users.set(ADMIN_ID, { id: ADMIN_ID, isSuperAdmin: true, isActive: true, isDeleted: false, email: "admin@example.com" });
		state.users.set(TARGET_ID, { id: TARGET_ID, isSuperAdmin: false, isActive: true, isDeleted: false, email: "target@example.com" });
	});

	describe("impersonateUser", () => {
		it("creates the server-side session, its START audit row and the impersonation.action event in one transaction", async () => {
			await createService().impersonateUser(ADMIN_ID, TARGET_ID);

			const [session] = [...state.sessions.values()];
			expect(session).toMatchObject({ impersonatorId: ADMIN_ID, targetUserId: TARGET_ID, endedAt: null });
			expect(state.committedAudit).toEqual([{ action: "START", impersonatorId: ADMIN_ID, sessionId: session?.id }]);
			expect(state.enqueueInTransaction).toHaveBeenCalledTimes(1);
			expect(state.enqueueInTransaction.mock.lastCall?.[0]).toBe(state.transactionClients[0]);
			expect(state.enqueueInTransaction.mock.lastCall?.[1]).toMatchObject({
				type: "impersonation.action",
				payload: { action: "start", superAdminId: ADMIN_ID, targetUserId: TARGET_ID, status: "succeeded" },
			});
		});

		it("binds the impersonation token to the new session id", async () => {
			await createService().impersonateUser(ADMIN_ID, TARGET_ID);

			const [session] = [...state.sessions.values()];
			expect(state.generateImpersonationToken).toHaveBeenCalledWith(expect.anything(), ADMIN_ID, session?.id);
		});

		it("rolls the session and the audit row back when the event cannot be written", async () => {
			state.enqueueInTransaction.mockRejectedValue(new Error("outbox insert failed"));

			await expect(createService().impersonateUser(ADMIN_ID, TARGET_ID)).rejects.toThrow("outbox insert failed");

			expect(state.committedAudit).toEqual([]);
			expect(state.sessions.size).toBe(0);
		});

		it("writes nothing when the impersonator is not a super admin", async () => {
			await expect(createService().impersonateUser(TARGET_ID, ADMIN_ID)).rejects.toThrow("Only super administrators can impersonate users");

			expect(state.committedAudit).toEqual([]);
			expect(state.sessions.size).toBe(0);
			expect(state.enqueueInTransaction).not.toHaveBeenCalled();
		});

		it("refuses a deactivated super admin", async () => {
			state.users.set(ADMIN_ID, { id: ADMIN_ID, isSuperAdmin: true, isActive: false, isDeleted: false, email: "admin@example.com" });

			await expect(createService().impersonateUser(ADMIN_ID, TARGET_ID)).rejects.toThrow("Only super administrators can impersonate users");
			expect(state.sessions.size).toBe(0);
		});
	});

	describe("stopImpersonation", () => {
		it("ends the session (revoking the token), writes the STOP audit row with the real actor and its event in one transaction", async () => {
			const sessionId = seedLiveSession();

			const result = await createService().stopImpersonation(ADMIN_ID, TARGET_ID, sessionId);

			expect(result.accessToken).toBe("admin-token");
			expect(state.sessions.get(sessionId)).toMatchObject({ endedBy: ADMIN_ID });
			expect(state.sessions.get(sessionId)?.endedAt).not.toBeNull();
			expect(state.committedAudit).toEqual([{ action: "STOP", impersonatorId: ADMIN_ID, sessionId }]);
			expect(state.enqueueInTransaction).toHaveBeenCalledTimes(1);
			expect(state.enqueueInTransaction.mock.lastCall?.[0]).toBe(state.transactionClients[0]);
			expect(state.enqueueInTransaction.mock.lastCall?.[1]).toMatchObject({ payload: { action: "stop", superAdminId: ADMIN_ID, targetUserId: TARGET_ID } });
		});

		it.each([
			["deactivated", { isSuperAdmin: true, isActive: false, isDeleted: false }],
			["soft-deleted", { isSuperAdmin: true, isActive: true, isDeleted: true }],
			["demoted", { isSuperAdmin: false, isActive: true, isDeleted: false }],
		])("restores nothing and writes nothing when the original admin was %s", async (_label: string, flags: Omit<UserRow, "id" | "email">) => {
			const sessionId = seedLiveSession();
			state.users.set(ADMIN_ID, { id: ADMIN_ID, email: "admin@example.com", ...flags });

			await expect(createService().stopImpersonation(ADMIN_ID, TARGET_ID, sessionId)).rejects.toMatchObject({ response: { error: "IMPERSONATOR_NOT_ELIGIBLE" } });

			expect(state.committedAudit).toEqual([]);
			expect(state.enqueueInTransaction).not.toHaveBeenCalled();
			expect(state.sessions.get(sessionId)?.endedAt).toBeNull();
		});

		it("refuses to stop (and restores no admin session) when the session already ended — a replayed stop cannot mint admin tokens", async () => {
			const sessionId = seedLiveSession();
			await createService().stopImpersonation(ADMIN_ID, TARGET_ID, sessionId);
			state.committedAudit.length = 0;
			state.enqueueInTransaction.mockClear();

			await expect(createService().stopImpersonation(ADMIN_ID, TARGET_ID, sessionId)).rejects.toMatchObject({ response: { error: "IMPERSONATION_SESSION_INVALID" } });

			expect(state.committedAudit).toEqual([]);
			expect(state.enqueueInTransaction).not.toHaveBeenCalled();
		});

		it("refuses a session that belongs to another impersonator / target", async () => {
			const sessionId = seedLiveSession();

			await expect(createService().stopImpersonation(ADMIN_ID, "someone-else", sessionId)).rejects.toMatchObject({
				response: { error: "IMPERSONATION_SESSION_INVALID" },
			});
			expect(state.sessions.get(sessionId)?.endedAt).toBeNull();
		});
	});
});
