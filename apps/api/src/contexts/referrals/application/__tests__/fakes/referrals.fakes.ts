// TEST-ONLY real implementations of the referrals ports (no vi.fn stubs of the subject).
import type { PaginatedServiceResult, SignupReferralRefereeItem } from "@workspace/shared";

import type { SignupReferralSummary } from "../../ports/signup-referral.port";
import type { SignupReferralDashboardFacts, SignupReferralReadPort } from "../../ports/signup-referral-read.port";
import type { CodeMaintenanceOutcome, SignupReferralCodeMaintenancePort } from "../../ports/signup-referral-maintenance.port";
import type { SignupReferralCodeForValidation } from "../../../domain/policies/signup-referral-code-validity.policy";

/** Code rows by canonical value, and the lookups made. */
export class InMemorySignupReferralReads implements SignupReferralReadPort {
	public readonly validations: string[] = [];
	public readonly summaryLookups: (readonly string[])[] = [];
	public facts: SignupReferralDashboardFacts = { latestCode: null, account: null };

	public constructor(
		private readonly codes: ReadonlyMap<string, SignupReferralCodeForValidation> = new Map(),
		private readonly summaries: ReadonlyMap<string, SignupReferralSummary> = new Map(),
	) {}

	public dashboardFacts(): Promise<SignupReferralDashboardFacts> {
		return Promise.resolve(this.facts);
	}

	public listReferees(): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		return Promise.resolve({ items: [], limit: 20, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false });
	}

	public findCodeForValidation(canonical: string): Promise<SignupReferralCodeForValidation | null> {
		this.validations.push(canonical);
		return Promise.resolve(this.codes.get(canonical) ?? null);
	}

	public summariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, SignupReferralSummary>> {
		this.summaryLookups.push(refereeUserIds);
		return Promise.resolve(new Map([...this.summaries].filter(([id]) => refereeUserIds.includes(id))));
	}
}

/** Pages of user ids and a scripted outcome (or failure) per user. */
export class ScriptedCodeMaintenance implements SignupReferralCodeMaintenancePort {
	public readonly pageRequests: { readonly now: number; readonly limit: number; readonly cursorId: string | null }[] = [];
	/** Every user a code was attempted for, in order. */
	public readonly issued: string[] = [];

	public constructor(
		private readonly pages: (readonly string[])[],
		private readonly outcomes: ReadonlyMap<string, CodeMaintenanceOutcome | Error>,
	) {}

	public listUserIdsNeedingCode(now: number, limit: number, cursorId: string | null): Promise<readonly string[]> {
		this.pageRequests.push({ now, limit, cursorId });
		return Promise.resolve(this.pages.shift() ?? []);
	}

	public issueCodeIfDue(userId: string): Promise<CodeMaintenanceOutcome> {
		this.issued.push(userId);
		const outcome = this.outcomes.get(userId) ?? "skipped";
		return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
	}
}
