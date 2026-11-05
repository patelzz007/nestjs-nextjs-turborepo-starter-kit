// The outgoing webhook catalog's producers (ADR 082, mechanism 1): each business event becomes a catalog event
// IN ITS OWN TRANSACTION, so the outbox row and the change it describes commit together. Payloads carry ids and
// business facts only: never a customer's name, email or phone number (the catalog's rule).

import type { InTransactionEventHandler } from "../../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../../platform/domain/domain-event";
import { ClaimExpired, ClaimRedeemed, RewardClaimed } from "../../../../../claims/public-api";
import { PaymentStatusChanged, type SettledPaymentStatus } from "../../../../../payments/public-api";
import { SaleCheckedOut } from "../../../../../pos/public-api";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../../../../rewards/public-api";
import type { WebhookIdGenerator } from "../../ports/webhook-ids.port";
import { recordWebhookEvent } from "../../services/webhook-event-recorder";
import type { WebhooksScope } from "../../webhooks-scope";

type RewardReviewEvent = RewardApproved | RewardAutoPublished | RewardRejected;

/** A reward went live (after review, or at its scheduled time) or was sent back. */
export class RecordWebhookOnRewardReview implements InTransactionEventHandler<RewardReviewEvent, WebhooksScope> {
	public constructor(private readonly ids: WebhookIdGenerator) {}

	public accepts(event: DomainEvent): event is RewardReviewEvent {
		return event instanceof RewardApproved || event instanceof RewardAutoPublished || event instanceof RewardRejected;
	}

	public async handle(event: RewardReviewEvent, scope: WebhooksScope): Promise<void> {
		if (event instanceof RewardRejected) {
			await recordWebhookEvent(
				scope,
				this.ids,
				event.tenantId,
				{ type: "reward.rejected", data: { rewardId: event.rewardId, title: event.title, reason: event.reason } },
				event.occurredAt,
			);
			return;
		}
		const via = event instanceof RewardApproved ? "review" : "schedule";
		await recordWebhookEvent(scope, this.ids, event.tenantId, { type: "reward.published", data: { rewardId: event.rewardId, title: event.title, via } }, event.occurredAt);
	}
}

type ClaimEvent = RewardClaimed | ClaimRedeemed | ClaimExpired;

/** A customer claimed a reward, a till redeemed a claim, or a claim ran out of time. */
export class RecordWebhookOnClaim implements InTransactionEventHandler<ClaimEvent, WebhooksScope> {
	public constructor(private readonly ids: WebhookIdGenerator) {}

	public accepts(event: DomainEvent): event is ClaimEvent {
		return event instanceof RewardClaimed || event instanceof ClaimRedeemed || event instanceof ClaimExpired;
	}

	public async handle(event: ClaimEvent, scope: WebhooksScope): Promise<void> {
		// A claim names its reward, not its tenant: the reward says whose it is (on this same transaction).
		const tenantId = event instanceof ClaimExpired ? event.tenantId : ((await scope.rewardFacts.factsFor(event.rewardId))?.tenantId ?? null);
		if (tenantId === null) {
			return;
		}
		const type = event instanceof RewardClaimed ? "claim.created" : event instanceof ClaimRedeemed ? "claim.redeemed" : "claim.expired";
		await recordWebhookEvent(
			scope,
			this.ids,
			tenantId,
			{ type, data: { claimId: event.claimId, rewardId: event.rewardId, isReferrerCredit: event.isReferrerCredit } },
			event.occurredAt,
		);
	}
}

/** A till checked out a bill with rewards on it. */
export class RecordWebhookOnSaleCheckedOut implements InTransactionEventHandler<SaleCheckedOut, WebhooksScope> {
	public constructor(private readonly ids: WebhookIdGenerator) {}

	public accepts(event: DomainEvent): event is SaleCheckedOut {
		return event instanceof SaleCheckedOut;
	}

	public async handle(event: SaleCheckedOut, scope: WebhooksScope): Promise<void> {
		await recordWebhookEvent(
			scope,
			this.ids,
			event.tenantId,
			{
				type: "sale.completed",
				data: {
					saleId: event.saleId,
					locationId: event.locationId,
					terminalId: event.terminalId,
					billTotalMinor: event.billTotalMinor,
					currency: event.currency,
					claimIds: [...event.claimIds],
				},
			},
			event.occurredAt,
		);
	}
}

const PAYMENT_EVENT_TYPES: Readonly<Record<SettledPaymentStatus, "payment.succeeded" | "payment.failed" | "payment.refunded">> = {
	PAID: "payment.succeeded",
	FAILED: "payment.failed",
	REFUNDED: "payment.refunded",
};

/** A payment was paid, failed at the gateway, or was refunded (the payer's name and email are never sent). */
export class RecordWebhookOnPaymentStatusChanged implements InTransactionEventHandler<PaymentStatusChanged, WebhooksScope> {
	public constructor(private readonly ids: WebhookIdGenerator) {}

	public accepts(event: DomainEvent): event is PaymentStatusChanged {
		return event instanceof PaymentStatusChanged;
	}

	public async handle(event: PaymentStatusChanged, scope: WebhooksScope): Promise<void> {
		await recordWebhookEvent(
			scope,
			this.ids,
			event.tenantId,
			{
				type: PAYMENT_EVENT_TYPES[event.status],
				data: {
					paymentId: event.paymentId,
					provider: event.provider,
					amountMinor: event.amountMinor,
					currency: event.currency,
					providerPaymentId: event.providerPaymentId,
					paidAt: event.paidAt,
				},
			},
			event.occurredAt,
		);
	}
}
