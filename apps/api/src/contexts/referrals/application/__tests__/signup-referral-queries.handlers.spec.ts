import {
	epochMs,
	SignupReferralRefereeListQuerySchema,
	type PaginatedServiceResult,
	type SignupReferralRefereeItem,
	type SignupReferralRefereeListQuery,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import type { SignupReferralCodeForValidation } from "../../domain/policies/signup-referral-code-validity.policy";
import type { SignupReferralDashboardFacts, SignupReferralReadPort } from "../ports/signup-referral-read.port";
import type { SignupReferralSummary } from "../ports/signup-referral.port";
import { GetMySignupReferralDashboardQuery } from "../queries/get-my-signup-referral-dashboard/get-my-signup-referral-dashboard.query";
import { GetMySignupReferralDashboardHandler } from "../queries/get-my-signup-referral-dashboard/get-my-signup-referral-dashboard.handler";
import { ListMyRefereesQuery } from "../queries/list-my-referees/list-my-referees.query";
import { ListMyRefereesHandler } from "../queries/list-my-referees/list-my-referees.handler";

const NOW = epochMs(1_800_000_000_000);
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const REFERRER: ActorContext = {
	kind: "user",
	userId: "referrer-1",
	sessionId: "session-1",
	organizationId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};
const KEY: ActorContext = { kind: "api_key", apiKeyId: "key-1", organizationId: "org-1", locationId: null, terminalId: null, request: REQUEST };

const REFEREE: SignupReferralRefereeItem = { fullName: "Aisha Rahman", createdAt: NOW, status: "redeemed" };

/** Dashboard facts and referee pages of one referrer, recording who asked for what. */
class ScriptedReads implements SignupReferralReadPort {
	public readonly asked: { readonly actor: ActorContext; readonly userId: string; readonly query: SignupReferralRefereeListQuery | null }[] = [];

	public constructor(private readonly facts: SignupReferralDashboardFacts) {}

	public dashboardFacts(actor: ActorContext, userId: string): Promise<SignupReferralDashboardFacts> {
		this.asked.push({ actor, userId, query: null });
		return Promise.resolve(this.facts);
	}

	public listReferees(actor: ActorContext, referrerUserId: string, query: SignupReferralRefereeListQuery): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		this.asked.push({ actor, userId: referrerUserId, query });
		const page = query.page;
		return Promise.resolve({ items: [REFEREE], total: 3, page, limit: query.limit, totalPages: 3, nextCursor: null, hasNext: page < 3, hasPrevious: page > 1 });
	}

	public findCodeForValidation(): Promise<SignupReferralCodeForValidation | null> {
		return Promise.reject(new Error("not used by the queries"));
	}

	public summariesForReferees(): Promise<ReadonlyMap<string, SignupReferralSummary>> {
		return Promise.reject(new Error("not used by the queries"));
	}
}

const ACTIVE_ACCOUNT = { isDeleted: false, isActive: true };

describe("GetMySignupReferralDashboardHandler", () => {
	it("decides the caller's own code state at the clock's time, never writing", async () => {
		const reads = new ScriptedReads({ latestCode: { code: "AB23CD45", expiresAt: epochMs(NOW + 1) }, account: ACTIVE_ACCOUNT });

		await expect(new GetMySignupReferralDashboardHandler(reads, new FixedClock(NOW)).execute(new GetMySignupReferralDashboardQuery(REFERRER))).resolves.toEqual({
			code: "AB23CD45",
			expiresAt: NOW + 1,
			shareable: true,
			codeState: "active",
		});
		expect(reads.asked).toEqual([{ actor: REFERRER, userId: "referrer-1", query: null }]);
	});

	it("answers a code expiring exactly now as expired, and a not-yet-backfilled account as pending", async () => {
		const expired = new ScriptedReads({ latestCode: { code: "AB23CD45", expiresAt: NOW }, account: ACTIVE_ACCOUNT });
		const pending = new ScriptedReads({ latestCode: null, account: ACTIVE_ACCOUNT });

		await expect(new GetMySignupReferralDashboardHandler(expired, new FixedClock(NOW)).execute(new GetMySignupReferralDashboardQuery(REFERRER))).resolves.toMatchObject({
			codeState: "expired",
			shareable: false,
		});
		await expect(new GetMySignupReferralDashboardHandler(pending, new FixedClock(NOW)).execute(new GetMySignupReferralDashboardQuery(REFERRER))).resolves.toEqual({
			code: null,
			expiresAt: null,
			shareable: false,
			codeState: "pending",
		});
	});

	it("is for signed-in users only, reading nothing for anyone else", async () => {
		const reads = new ScriptedReads({ latestCode: null, account: null });

		await expect(new GetMySignupReferralDashboardHandler(reads, new FixedClock(NOW)).execute(new GetMySignupReferralDashboardQuery(KEY))).rejects.toBeInstanceOf(
			AuthenticationError,
		);
		expect(reads.asked).toEqual([]);
	});
});

describe("ListMyRefereesHandler", () => {
	it("pages the caller's own referees (the caller is the scope, never input)", async () => {
		const reads = new ScriptedReads({ latestCode: null, account: null });
		const query = SignupReferralRefereeListQuerySchema.parse({ page: "2", limit: "1" });

		await expect(new ListMyRefereesHandler(reads).execute(new ListMyRefereesQuery(REFERRER, query))).resolves.toEqual({
			items: [REFEREE],
			total: 3,
			page: 2,
			limit: 1,
			totalPages: 3,
			nextCursor: null,
			hasNext: true,
			hasPrevious: true,
		});
		expect(reads.asked).toEqual([{ actor: REFERRER, userId: "referrer-1", query }]);
	});

	it("is for signed-in users only", async () => {
		const reads = new ScriptedReads({ latestCode: null, account: null });

		await expect(new ListMyRefereesHandler(reads).execute(new ListMyRefereesQuery(KEY, SignupReferralRefereeListQuerySchema.parse({})))).rejects.toBeInstanceOf(
			AuthenticationError,
		);
		expect(reads.asked).toEqual([]);
	});
});
