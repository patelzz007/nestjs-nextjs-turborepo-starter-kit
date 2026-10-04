import { MfaRecoveryRequestStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { MfaRecoveryRepository, MfaRecoveryIntegrityError } from "./mfa-recovery.repository";

interface RequestRow {
	readonly id: string;
	readonly userId: string;
	status: MfaRecoveryRequestStatus;
	reviewedBy: string | null;
	scheduledUnlockAt: number | null;
}

interface WriteLog {
	readonly model: string;
	readonly op: string;
	readonly args: object;
}

interface FakeDatabase {
	readonly requests: Map<string, RequestRow>;
	readonly superAdmins: Set<string>;
	readonly writes: WriteLog[];
	readonly systemOperations: string[];
}

const db = vi.hoisted((): FakeDatabase => ({
	requests: new Map<string, RequestRow>(),
	superAdmins: new Set<string>(),
	writes: [],
	systemOperations: [],
}));

function matchesStatus(row: RequestRow, status: MfaRecoveryRequestStatus | { readonly in: readonly MfaRecoveryRequestStatus[] }): boolean {
	return typeof status === "string" ? row.status === status : status.in.includes(row.status);
}

/** A transaction client over the in-memory rows: enough Prisma surface for the repository. */
function transactionClient(): object {
	return {
		$executeRaw: (): Promise<number> => {
			db.writes.push({ model: "lock", op: "advisory", args: {} });
			return Promise.resolve(1);
		},
		user: {
			findFirst: (args: { readonly where: { readonly id: string } }): Promise<{ readonly id: string } | null> =>
				Promise.resolve(db.superAdmins.has(args.where.id) ? { id: args.where.id } : null),
			update: (args: object): Promise<object> => {
				db.writes.push({ model: "user", op: "update", args });
				return Promise.resolve({});
			},
		},
		mfaRecoveryRequest: {
			findFirst: (args: {
				readonly where: { readonly userId: string; readonly status: { readonly in: readonly MfaRecoveryRequestStatus[] } };
			}): Promise<{ readonly id: string } | null> =>
				Promise.resolve([...db.requests.values()].find((row) => row.userId === args.where.userId && matchesStatus(row, args.where.status)) ?? null),
			findUnique: (args: { readonly where: { readonly id: string } }): Promise<RequestRow | null> => Promise.resolve(db.requests.get(args.where.id) ?? null),
			findUniqueOrThrow: (args: { readonly where: { readonly id: string } }): Promise<RequestRow> => {
				const row = db.requests.get(args.where.id);
				return row === undefined ? Promise.reject(new Error("not found")) : Promise.resolve(row);
			},
			create: (args: { readonly data: { readonly userId: string } }): Promise<RequestRow> => {
				const row: RequestRow = { id: `req-${String(db.requests.size + 1)}`, userId: args.data.userId, status: "PENDING", reviewedBy: null, scheduledUnlockAt: null };
				db.requests.set(row.id, row);
				return Promise.resolve(row);
			},
			updateMany: (args: {
				readonly where: { readonly id: string; readonly status: MfaRecoveryRequestStatus };
				readonly data: { readonly status: MfaRecoveryRequestStatus; readonly reviewedBy?: string };
			}): Promise<{ readonly count: number }> => {
				const row = db.requests.get(args.where.id);
				if (row?.status !== args.where.status) {
					return Promise.resolve({ count: 0 });
				}
				row.status = args.data.status;
				row.reviewedBy = args.data.reviewedBy ?? row.reviewedBy;
				db.writes.push({ model: "mfaRecoveryRequest", op: "updateMany", args });
				return Promise.resolve({ count: 1 });
			},
		},
		backupCode: {
			updateMany: (args: object): Promise<{ readonly count: number }> => {
				db.writes.push({ model: "backupCode", op: "updateMany", args });
				return Promise.resolve({ count: 1 });
			},
		},
		twoFactorPendingSetup: {
			deleteMany: (args: object): Promise<{ readonly count: number }> => {
				db.writes.push({ model: "twoFactorPendingSetup", op: "deleteMany", args });
				return Promise.resolve({ count: 0 });
			},
		},
		mfaRecoveryAuditLog: {
			create: (args: object): Promise<object> => {
				db.writes.push({ model: "mfaRecoveryAuditLog", op: "create", args });
				return Promise.resolve({});
			},
		},
	};
}

vi.mock("../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public async withSystemOperation<T>(context: { readonly operation: string }, handler: (tx: object) => Promise<T>): Promise<T> {
			db.systemOperations.push(context.operation);
			return handler(transactionClient());
		}
	},
}));

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const REQUESTER = "user-1";
const REVIEWER = "admin-2";
const NOW = 1_800_000_000_000;

function repository(): MfaRecoveryRepository {
	const requestContext = new RequestContextService();
	return new MfaRecoveryRepository(new TenantTransactionService(new PrismaService(createTestTypedConfig()), requestContext), requestContext);
}

function auditRows(): WriteLog[] {
	return db.writes.filter((write) => write.model === "mfaRecoveryAuditLog");
}

function seedRequest(status: MfaRecoveryRequestStatus, overrides: Partial<RequestRow> = {}): RequestRow {
	const row: RequestRow = { id: "req-1", userId: REQUESTER, status, reviewedBy: null, scheduledUnlockAt: null, ...overrides };
	db.requests.set(row.id, row);
	return row;
}

describe("MfaRecoveryRepository", () => {
	beforeEach(() => {
		db.requests.clear();
		db.superAdmins.clear();
		db.superAdmins.add(REVIEWER);
		db.superAdmins.add(REQUESTER);
		db.writes.length = 0;
		db.systemOperations.length = 0;
	});

	describe("openRequest", () => {
		it("opens a PENDING request under the per-user advisory lock and writes its audit row with the requester as actor", async () => {
			const result = await repository().openRequest(REQUESTER, "lost phone", NOW);

			expect(result.kind).toBe("opened");
			expect(db.writes[0]).toMatchObject({ model: "lock" });
			expect(auditRows()).toHaveLength(1);
			expect(auditRows()[0]).toMatchObject({
				args: { data: { requestId: "req-1", subjectUserId: REQUESTER, action: "mfa_recovery.requested", actorUserId: REQUESTER, toStatus: "PENDING" } },
			});
			expect(db.systemOperations).toEqual(["auth.mfa_recovery.request"]);
		});

		it("refuses a second open request for the same user", async () => {
			seedRequest("APPROVED");

			await expect(repository().openRequest(REQUESTER, null, NOW)).resolves.toEqual({ kind: "already_open" });
			expect(auditRows()).toEqual([]);
		});
	});

	describe("review", () => {
		const approve = { requestId: "req-1", decision: MfaRecoveryRequestStatus.APPROVED, reviewedAt: NOW, scheduledUnlockAt: NOW + 1, notes: undefined };

		it("refuses self-approval even when the requester is a super admin", async () => {
			seedRequest("PENDING");

			await expect(repository().review({ ...approve, reviewerId: REQUESTER })).resolves.toEqual({ kind: "self_review" });
			expect(db.requests.get("req-1")?.status).toBe("PENDING");
			expect(auditRows()).toEqual([]);
		});

		it("refuses a reviewer who is not an active super admin", async () => {
			seedRequest("PENDING");

			await expect(repository().review({ ...approve, reviewerId: "not-an-admin" })).resolves.toEqual({ kind: "reviewer_not_eligible" });
			expect(auditRows()).toEqual([]);
		});

		it("transitions PENDING → APPROVED with a compare-and-set and audits it with the reviewer as actor", async () => {
			seedRequest("PENDING");

			const result = await repository().review({ ...approve, reviewerId: REVIEWER });

			expect(result.kind).toBe("reviewed");
			expect(db.writes.find((write) => write.model === "mfaRecoveryRequest")).toMatchObject({ args: { where: { id: "req-1", status: "PENDING" } } });
			expect(auditRows()).toHaveLength(1);
			expect(auditRows()[0]).toMatchObject({ args: { data: { action: "mfa_recovery.approved", actorUserId: REVIEWER, requestId: "req-1", subjectUserId: REQUESTER } } });
			expect(db.systemOperations).toEqual(["auth.mfa_recovery.review"]);
		});

		it("lets only one of two reviews win (the loser sees not_pending and writes nothing)", async () => {
			seedRequest("PENDING");
			await repository().review({ ...approve, reviewerId: REVIEWER });
			db.writes.length = 0;

			await expect(repository().review({ ...approve, decision: MfaRecoveryRequestStatus.DENIED, scheduledUnlockAt: null, reviewerId: REVIEWER })).resolves.toEqual({
				kind: "not_pending",
			});
			expect(auditRows()).toEqual([]);
		});

		it("reports not_found for an unknown request", async () => {
			await expect(repository().review({ ...approve, reviewerId: REVIEWER })).resolves.toEqual({ kind: "not_found" });
		});
	});

	describe("complete", () => {
		it("soft-deletes the backup codes (deletedBy = approving admin), bumps tokenVersion and audits — never a DELETE of backup codes", async () => {
			seedRequest("APPROVED", { reviewedBy: REVIEWER, scheduledUnlockAt: NOW - 1 });

			await expect(repository().complete("req-1", NOW)).resolves.toEqual({ kind: "completed", userId: REQUESTER, reviewerId: REVIEWER });

			expect(db.writes.find((write) => write.model === "backupCode")).toMatchObject({
				op: "updateMany",
				args: { where: { userId: REQUESTER, isDeleted: false }, data: { isDeleted: true, deletedAt: NOW, deletedBy: REVIEWER } },
			});
			expect(db.writes.some((write) => write.model === "backupCode" && write.op !== "updateMany")).toBe(false);
			expect(db.writes.find((write) => write.model === "user")).toMatchObject({ args: { data: { twoFactorEnabled: false, tokenVersion: { increment: 1 } } } });
			expect(auditRows()).toHaveLength(1);
			expect(auditRows()[0]).toMatchObject({ args: { data: { action: "mfa_recovery.completed", actorUserId: REVIEWER } } });
		});

		it("does nothing when another worker already completed the request", async () => {
			seedRequest("COMPLETED", { reviewedBy: REVIEWER });

			await expect(repository().complete("req-1", NOW)).resolves.toEqual({ kind: "not_due" });
			expect(db.writes).toEqual([]);
		});

		it("refuses an APPROVED request without a reviewer instead of inventing an actor", async () => {
			seedRequest("APPROVED");

			await expect(repository().complete("req-1", NOW)).rejects.toBeInstanceOf(MfaRecoveryIntegrityError);
		});
	});
});
