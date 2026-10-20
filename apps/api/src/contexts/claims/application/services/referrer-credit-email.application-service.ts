import { Logger } from "@nestjs/common";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { ReferrerRewardCreditedEmailTemplate } from "../../../notifications/public-api";
import { REFERRER_CLAIM_TTL_DAYS, type ReferrerCreditCursor, type UnnotifiedReferrerCredit } from "../../../referrals/public-api";
import type { ClaimsScope } from "../claims-scope";

/**
 * The system operation every request runs under: it reads the referrer's address and marks the
 * referral, which the till's key that credited it may not (and the sweeper has no caller at all).
 * The name is the one the legacy delivery used, so the RLS allowlist is unchanged.
 */
export const REFERRER_CREDIT_EMAIL_OPERATION: SystemOperationName = "rewards.referral_credit.deliver";

/** Credited referrals one sweeper page reads. */
export const REFERRER_CREDIT_EMAIL_BATCH = 50;

/** Pages one sweeper run reads at most (bounds a run; the next run starts from the oldest again). */
export const REFERRER_CREDIT_EMAIL_MAX_PAGES = 20;

/**
 * What one request did. `undeliverable`: the email can never be built from this referral's data
 * (`invalid-props`), so the referral is marked and logged instead of retried forever.
 */
export type ReferrerCreditEmailOutcome = "requested" | "already-requested" | "skipped" | "undeliverable";

/** How one sweep went. */
export interface ReferrerCreditEmailSweep {
	readonly requested: number;
	/** Another worker requested it first. */
	readonly alreadyRequested: number;
	/** Marked without an email: the referrer or the credit claim's reward is gone, or the email can never be built. */
	readonly skipped: number;
	/** Left owed after a transient failure (retried by the next run). */
	readonly failed: number;
}

/** The email log could not be written (a transient failure); the transaction rolls back and the referral stays owed. */
export class ReferrerCreditEmailNotRequestedError extends Error {
	public constructor(referralId: string, reason: string) {
		super(`The referrer-credit email for referral ${referralId} was not requested (${reason})`);
		this.name = "ReferrerCreditEmailNotRequestedError";
	}
}

/**
 * Requests the "you earned a referrer reward" email for a credited referral, in ONE transaction with
 * the referral's `creditNotifiedAt` (decision #44): the email log row and its outbox record commit
 * with the mark, so the email is requested exactly once and delivered durably (ADR 060). A referral
 * whose credit claim or referrer reward is gone is marked without an email: there is nothing left
 * for the referrer to redeem.
 */
export class ReferrerCreditEmailApplicationService {
	private readonly logger: Logger = new Logger(ReferrerCreditEmailApplicationService.name);

	public constructor(
		private readonly uow: UnitOfWork<ClaimsScope>,
		private readonly clock: Clock,
	) {}

	public async request(actor: ActorContext, credit: Pick<UnnotifiedReferrerCredit, "referralId" | "referrerUserId">): Promise<ReferrerCreditEmailOutcome> {
		return this.uow.runSystemOperation(REFERRER_CREDIT_EMAIL_OPERATION, actor, async (scope: ClaimsScope): Promise<ReferrerCreditEmailOutcome> => {
			if (!(await scope.referrerCreditNotices.markNotified(credit.referralId, this.clock.now()))) {
				return "already-requested";
			}
			const creditClaim = await scope.claims.findReferrerCredit(credit.referralId);
			const reward = creditClaim === null ? null : await scope.rewardFacts.factsFor(creditClaim.rewardId);
			const referrer = await scope.claimants.profile(credit.referrerUserId);
			if (reward === null || referrer === null) {
				this.logger.warn({
					event: "referrals.referrer_credit_email_skipped",
					referralId: credit.referralId,
					creditClaimFound: creditClaim !== null,
					referrerFound: referrer !== null,
				});
				return "skipped";
			}
			const result = await scope.emails.request(
				new ReferrerRewardCreditedEmailTemplate({ to: referrer.email, rewardTitle: reward.title, claimExpiresDays: REFERRER_CLAIM_TTL_DAYS }),
			);
			if (!result.ok && result.reason === "invalid-props") {
				this.logger.error({ event: "referrals.referrer_credit_email_undeliverable", referralId: credit.referralId, reason: result.reason });
				return "undeliverable";
			}
			if (!result.ok) {
				throw new ReferrerCreditEmailNotRequestedError(credit.referralId, result.reason);
			}
			return "requested";
		});
	}

	/**
	 * Requests the email of every credited referral still owed one (oldest credit first), one
	 * transaction each, paging by keyset so a referral that keeps failing never blocks the ones behind
	 * it. One failure does not stop the others; the run then rethrows the first failure so the job is
	 * retried and audited as failed. Permanent failures are marked (`undeliverable`) and never rethrown.
	 */
	public async sweep(actor: ActorContext): Promise<ReferrerCreditEmailSweep> {
		const outcomes: ReferrerCreditEmailOutcome[] = [];
		const failures: Error[] = [];
		let after: ReferrerCreditCursor | null = null;
		for (let page = 0; page < REFERRER_CREDIT_EMAIL_MAX_PAGES; page += 1) {
			const cursor: ReferrerCreditCursor | null = after;
			const owed: readonly UnnotifiedReferrerCredit[] = await this.uow.runSystemOperation(
				REFERRER_CREDIT_EMAIL_OPERATION,
				actor,
				async (scope: ClaimsScope): Promise<readonly UnnotifiedReferrerCredit[]> => scope.referrerCreditNotices.listUnnotified(REFERRER_CREDIT_EMAIL_BATCH, cursor),
			);
			for (const credit of owed) {
				try {
					outcomes.push(await this.request(actor, credit));
				} catch (error) {
					failures.push(error instanceof Error ? error : new Error(String(error)));
				}
			}
			const last: UnnotifiedReferrerCredit | undefined = owed.at(-1);
			if (last === undefined || owed.length < REFERRER_CREDIT_EMAIL_BATCH) {
				break;
			}
			after = { creditedAt: last.creditedAt, referralId: last.referralId };
		}
		const count = (outcome: ReferrerCreditEmailOutcome): number => outcomes.filter((candidate): boolean => candidate === outcome).length;
		const result: ReferrerCreditEmailSweep = {
			requested: count("requested"),
			alreadyRequested: count("already-requested"),
			skipped: count("skipped") + count("undeliverable"),
			failed: failures.length,
		};
		this.logger.log({ event: "referrals.referrer_credit_email.sweep", ...result });
		const [firstFailure] = failures;
		if (firstFailure !== undefined) {
			throw firstFailure;
		}
		return result;
	}
}
