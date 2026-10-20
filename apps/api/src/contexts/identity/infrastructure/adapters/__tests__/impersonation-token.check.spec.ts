import type { ImpersonationSession, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accessToken } from "../../../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import type { SystemDatabaseContext } from "../../../../../prisma/tenant-context";
import { ImpersonationTokenCheck } from "../impersonation-token.check";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

const STARTED_AT = 1_800_000_000_000n;
const TTL_MS = 900_000n;
const IMPERSONATION_CLAIMS = { sub: "target-1", id: "target-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "session-1" };

function liveSession(): ImpersonationSession {
	return {
		...LIVE_ROW_FIELDS,
		id: "session-1",
		impersonatorId: "admin-1",
		targetUserId: "target-1",
		startedAt: STARTED_AT,
		expiresAt: STARTED_AT + TTL_MS,
		endedAt: null,
		endedBy: null,
		endReason: null,
		ipAddress: null,
		userAgent: null,
		supportAccessGrantIds: [],
		createdAt: STARTED_AT,
		updatedAt: STARTED_AT,
	};
}

describe("ImpersonationTokenCheck", () => {
	let prisma: PrismaService;

	beforeEach(() => {
		prisma = new PrismaService(createTestTypedConfig());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function check(): ImpersonationTokenCheck {
		return new ImpersonationTokenCheck({
			withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => work(prisma),
		});
	}

	it("does not consult impersonation sessions for a regular token", async () => {
		const findFirst = vi.spyOn(prisma.impersonationSession, "findFirst");

		await expect(check().assertLiveIfImpersonating(accessToken({}))).resolves.toBeUndefined();
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("rejects an impersonation token that carries no session id (issued before sessions were tracked)", async () => {
		const findFirst = vi.spyOn(prisma.impersonationSession, "findFirst");

		await expect(check().assertLiveIfImpersonating(accessToken({ ...IMPERSONATION_CLAIMS, impersonationSessionId: undefined }))).rejects.toMatchObject({
			response: { error: "IMPERSONATION_SESSION_INVALID" },
		});
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("accepts a live session for the same impersonator and target, still a SuperAdmin", async () => {
		const findFirst = vi.spyOn(prisma.impersonationSession, "findFirst").mockResolvedValue(liveSession());

		await check().assertLiveIfImpersonating(accessToken(IMPERSONATION_CLAIMS));

		const [firstCall] = findFirst.mock.calls;
		const [query] = firstCall ?? [];
		expect(query?.where).toMatchObject({
			id: "session-1",
			impersonatorId: "admin-1",
			targetUserId: "target-1",
			endedAt: null,
			impersonator: { isSuperAdmin: true, isActive: true, isDeleted: false },
		});
	});

	it("rejects a session that ended, expired or is unknown", async () => {
		vi.spyOn(prisma.impersonationSession, "findFirst").mockResolvedValue(null);

		await expect(check().assertLiveIfImpersonating(accessToken(IMPERSONATION_CLAIMS))).rejects.toMatchObject({
			response: { error: "IMPERSONATION_SESSION_INVALID" },
		});
	});
});
