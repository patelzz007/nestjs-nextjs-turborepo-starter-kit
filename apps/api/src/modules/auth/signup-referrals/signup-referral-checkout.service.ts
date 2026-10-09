import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { SignupReferralRepository, type PendingSignupReferralNotification } from "./signup-referral.repository";

/**
 * The system operation every success-notification delivery runs under. It
 * reads the referee's name and writes into the referrer's inbox — neither the
 * POS key that stamped the success nor the retry job may do that on its own.
 */
const NOTIFY_SUCCESS_OPERATION = "auth.signup_referrals.notify_success";

/** Owed notifications the retry pass reads per page; it pages until the backlog is drained. */
export const SIGNUP_REFERRAL_NOTIFY_PAGE_SIZE = 100;

/** Outcome of one delivery attempt. */
export type SignupReferralNotificationDelivery = "delivered" | "already-delivered";

/** What one retry pass did. */
export interface SignupReferralNotifyResult {
	readonly delivered: number;
	readonly failed: number;
}

/**
 * Signup-referral success (ADR 035, "Success" and "Notification").
 *
 * Checkout stamps `successfulAt` inside its own transaction and, after commit,
 * delivers the one in-app notification for the referral it stamped. Whatever
 * is still owed (a failed write, a crash between commit and delivery) is
 * delivered by the hourly retry pass. Delivery is exactly-once: the claim on
 * `successNotifiedAt` and the notification insert commit together.
 */
@Injectable()
export class SignupReferralCheckoutService {
	private readonly logger: Logger = new Logger(SignupReferralCheckoutService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly repository: SignupReferralRepository,
	) {}

	/** Stamp the referee's signup referral successful on the checkout transaction; returns the stamped referral's id, or null. */
	public async markSuccessfulInTransaction(tx: Prisma.TransactionClient, refereeUserId: string, paidAt: number): Promise<string | null> {
		return this.repository.markSuccessfulInTx(tx, refereeUserId, paidAt);
	}

	/**
	 * After the checkout committed: deliver the notification for the referral it
	 * stamped. The sale is final either way — a failure is logged and left owed
	 * for the retry pass, never surfaced to the till.
	 */
	public async deliverAfterCheckout(signupReferralId: string | null): Promise<void> {
		if (signupReferralId === null) {
			return;
		}
		try {
			await this.deliver(signupReferralId);
		} catch (error) {
			this.logger.error({ event: "signup_referral.notification_deferred", signupReferralId, error: error instanceof Error ? error.message : String(error) });
		}
	}

	/** Deliver one referral's notification if it is still owed. */
	public async deliver(signupReferralId: string): Promise<SignupReferralNotificationDelivery> {
		return runWithSystemRlsContext(NOTIFY_SUCCESS_OPERATION, async (): Promise<SignupReferralNotificationDelivery> =>
			this.prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<SignupReferralNotificationDelivery> => {
				if (!(await this.repository.claimSuccessNotificationInTx(tx, signupReferralId, Date.now()))) {
					return "already-delivered";
				}
				const subject = await this.repository.findNotificationSubjectInTx(tx, signupReferralId);
				if (subject === null) {
					return "already-delivered";
				}
				await this.repository.insertSuccessNotificationInTx(tx, signupReferralId, subject);
				return "delivered";
			}),
		);
	}

	/**
	 * The retry pass: every owed notification, oldest success first. A row that
	 * fails is logged and stepped past (keyset paging), so it never blocks the
	 * rows behind it; it stays owed for the next run.
	 */
	public async deliverPendingSuccessNotifications(): Promise<SignupReferralNotifyResult> {
		return runWithSystemRlsContext(NOTIFY_SUCCESS_OPERATION, async (): Promise<SignupReferralNotifyResult> => {
			let delivered = 0;
			let failed = 0;
			let after: PendingSignupReferralNotification | null = null;
			for (;;) {
				const page: readonly PendingSignupReferralNotification[] = await this.repository.listPendingSuccessNotifications(SIGNUP_REFERRAL_NOTIFY_PAGE_SIZE, after);
				const last = page.at(-1);
				if (last === undefined) {
					break;
				}
				after = last;
				for (const pending of page) {
					try {
						delivered += (await this.deliver(pending.id)) === "delivered" ? 1 : 0;
					} catch (error) {
						failed += 1;
						this.logger.error({ event: "signup_referral.notification_failed", signupReferralId: pending.id, error: error instanceof Error ? error.message : String(error) });
					}
				}
			}
			return { delivered, failed };
		});
	}
}
