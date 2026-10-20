import { Logger } from "@nestjs/common";
import { SIGNUP_REFERRALS_SCREEN_PATH } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { OwedSignupSuccessNotice } from "../../../referrals/public-api";
import type { ClaimsScope } from "../claims-scope";

/**
 * The system operation every delivery runs under: it reads the referee's name and writes the referrer's
 * inbox, which neither the till's key that stamped the referral nor a job may do otherwise. The name is
 * the one referrals' delivery used, so the RLS allowlist is unchanged.
 */
export const SIGNUP_SUCCESS_NOTICE_OPERATION: SystemOperationName = "auth.signup_referrals.notify_success";

/** `RewardNotification.type` of the referrer's "your referral is successful" notice (byte-stable; clients render on it). */
export const SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE = "signup_referral_redeemed";

/** Owed notices one sweep page reads; the sweep pages until the backlog is drained. */
export const SIGNUP_SUCCESS_NOTICE_PAGE_SIZE = 100;

/** What one delivery did. */
export type SignupSuccessNoticeDelivery = "delivered" | "already-delivered";

/** What one sweep did. */
export interface SignupSuccessNoticeSweep {
	readonly delivered: number;
	readonly failed: number;
}

/** The claimed referral names a referee with no account row at all: corrupt data, rolled back and retried. */
export class SignupSuccessRefereeMissingError extends Error {
	public constructor(signupReferralId: string) {
		super(`Signup referral ${signupReferralId} names a referee with no account`);
		this.name = "SignupSuccessRefereeMissingError";
	}
}

/** A sweep delivered every notice it could, but some failed (they stay owed); thrown at the end so the run is audited as failed. */
export class SignupSuccessNoticesFailedError extends Error {
	public constructor(
		public readonly failed: number,
		public readonly firstFailure: Error,
	) {
		super(`${String(failed)} signup-referral success notice(s) failed; first: ${firstFailure.message}`, { cause: firstFailure });
		this.name = "SignupSuccessNoticesFailedError";
	}
}

/**
 * Delivers the referrer's "your referral is successful" notice (ADR 035, "Notification") in ONE
 * transaction with referrals' `successNotifiedAt` claim: exactly one concurrent deliverer writes the
 * inbox row, and a failed insert rolls the claim back. Claims owns the inbox and reaches the referee's
 * name through identity, so referrals writes neither.
 */
export class SignupSuccessNoticeApplicationService {
	private readonly logger: Logger = new Logger(SignupSuccessNoticeApplicationService.name);

	public constructor(
		private readonly uow: UnitOfWork<ClaimsScope>,
		private readonly clock: Clock,
	) {}

	public async deliver(actor: ActorContext, signupReferralId: string): Promise<SignupSuccessNoticeDelivery> {
		return this.uow.runSystemOperation(SIGNUP_SUCCESS_NOTICE_OPERATION, actor, async (scope: ClaimsScope): Promise<SignupSuccessNoticeDelivery> => {
			const claimed = await scope.signupSuccessNotices.claim(signupReferralId, this.clock.now());
			if (claimed === null) {
				return "already-delivered";
			}
			const refereeName = await scope.claimants.displayName(claimed.refereeUserId);
			if (refereeName === null) {
				throw new SignupSuccessRefereeMissingError(signupReferralId);
			}
			await scope.notifications.add([
				{
					userId: claimed.referrerUserId,
					type: SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE,
					title: "Referral successful",
					body: `${refereeName} redeemed a reward. Your referral is successful.`,
					metadata: { signupReferralId, href: SIGNUP_REFERRALS_SCREEN_PATH },
				},
			]);
			return "delivered";
		});
	}

	/**
	 * Delivers every owed notice, oldest success first, one transaction each. A notice that fails is
	 * logged and stepped past (keyset paging), so it never blocks the ones behind it and stays owed for
	 * the next run; the run then throws {@link SignupSuccessNoticesFailedError} so it is audited as failed.
	 */
	public async sweep(actor: ActorContext): Promise<SignupSuccessNoticeSweep> {
		let delivered = 0;
		const failures: Error[] = [];
		let after: OwedSignupSuccessNotice | null = null;
		for (;;) {
			const cursor: OwedSignupSuccessNotice | null = after;
			const page: readonly OwedSignupSuccessNotice[] = await this.uow.runSystemOperation(
				SIGNUP_SUCCESS_NOTICE_OPERATION,
				actor,
				async (scope: ClaimsScope): Promise<readonly OwedSignupSuccessNotice[]> => scope.signupSuccessNotices.listOwed(SIGNUP_SUCCESS_NOTICE_PAGE_SIZE, cursor),
			);
			const last: OwedSignupSuccessNotice | undefined = page.at(-1);
			if (last === undefined) {
				break;
			}
			after = last;
			for (const owed of page) {
				try {
					delivered += (await this.deliver(actor, owed.signupReferralId)) === "delivered" ? 1 : 0;
				} catch (error) {
					const failure = error instanceof Error ? error : new Error(String(error));
					failures.push(failure);
					this.logger.error({ event: "signup_referral.notification_failed", signupReferralId: owed.signupReferralId, error: failure.message });
				}
			}
		}
		const result: SignupSuccessNoticeSweep = { delivered, failed: failures.length };
		const [firstFailure] = failures;
		if (firstFailure !== undefined) {
			throw new SignupSuccessNoticesFailedError(failures.length, firstFailure);
		}
		return result;
	}
}
