import { Injectable, Logger } from "@nestjs/common";

import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { ReferrerRewardCreditedEmailTemplate } from "../../notifications/email/templates/referrer-reward-credited-email.template";
import { RewardReferralRepository, type PendingCreditNotification } from "../repositories/reward-referral.repository";
import { REFERRER_CLAIM_TTL_DAYS } from "./referral-credit.constants";

/**
 * The system operation every delivery runs under. Delivery reads the referrer's email and marks the
 * referral notified — a platform concern, never the caller's: a POS key that just credited the
 * referral may not read user rows, and the retry job has no caller at all.
 */
const DELIVERY_OPERATION = "rewards.referral_credit.deliver";

/** Credited referrals the delivery job handles per run. */
export const REFERRAL_CREDIT_NOTIFY_BATCH = 50;

/** Outcome of one delivery attempt. */
export type ReferralCreditDelivery = "delivered" | "already-delivered" | "failed";

/**
 * Delivers the "you earned a referrer reward" email for referrals the POS
 * checkout credited.
 *
 * The credit itself commits inside the checkout transaction and leaves the
 * referral with `creditNotifiedAt = NULL` — that row IS the outbox record. The
 * checkout tries delivery right after its commit; whatever is still pending
 * (mailer down, process crash between commit and send) is retried by the
 * `rewards.referral-credit-notify` job ({@link deliverPending}). Delivery is
 * at-least-once: the row is marked only after the mailer accepted the email.
 */
@Injectable()
export class ReferralCreditNotificationService {
	private readonly logger: Logger = new Logger(ReferralCreditNotificationService.name);

	public constructor(
		private readonly referralRepository: RewardReferralRepository,
		private readonly emailSender: EmailSenderService,
	) {}

	/** Delivers one referral's email if it is still pending. */
	public async deliver(referralId: string): Promise<ReferralCreditDelivery> {
		return runWithSystemRlsContext(DELIVERY_OPERATION, async (): Promise<ReferralCreditDelivery> => {
			const pending = await this.referralRepository.findPendingCreditNotification(referralId);
			return pending === null ? "already-delivered" : this.send(pending);
		});
	}

	/** Delivers up to {@link REFERRAL_CREDIT_NOTIFY_BATCH} pending emails, oldest credit first. */
	public async deliverPending(): Promise<{ readonly delivered: number; readonly failed: number }> {
		return runWithSystemRlsContext(DELIVERY_OPERATION, async (): Promise<{ readonly delivered: number; readonly failed: number }> => this.deliverBatch());
	}

	private async deliverBatch(): Promise<{ readonly delivered: number; readonly failed: number }> {
		const pending = await this.referralRepository.listPendingCreditNotifications(REFERRAL_CREDIT_NOTIFY_BATCH);
		let delivered = 0;
		let failed = 0;
		for (const notification of pending) {
			const outcome = await this.send(notification);
			if (outcome === "delivered") {
				delivered += 1;
			} else if (outcome === "failed") {
				failed += 1;
			}
		}
		return { delivered, failed };
	}

	private async send(notification: PendingCreditNotification): Promise<ReferralCreditDelivery> {
		const result = await this.emailSender.send(
			new ReferrerRewardCreditedEmailTemplate({
				to: notification.referrerEmail,
				rewardTitle: notification.referrerRewardTitle,
				claimExpiresDays: REFERRER_CLAIM_TTL_DAYS,
			}),
		);
		if (!result.ok) {
			// The referral stays pending; the delivery job retries it.
			this.logger.warn({ event: "rewards.referral_credit_email_failed", referralId: notification.referralId, reason: result.reason, detail: result.detail });
			return "failed";
		}
		return (await this.referralRepository.markCreditNotified(notification.referralId, Date.now())) ? "delivered" : "already-delivered";
	}
}
