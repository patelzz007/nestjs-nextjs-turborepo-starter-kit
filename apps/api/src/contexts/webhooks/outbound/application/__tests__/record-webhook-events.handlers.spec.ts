import { epochMs, PaymentCurrencySchema, PaymentProviderNameSchema } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { ClaimExpired, ClaimRedeemed, RewardClaimed } from "../../../../claims/public-api";
import { PaymentStatusChanged } from "../../../../payments/public-api";
import { SaleCheckedOut } from "../../../../pos/public-api";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../../../rewards/public-api";
import {
	RecordWebhookOnClaim,
	RecordWebhookOnPaymentStatusChanged,
	RecordWebhookOnRewardReview,
	RecordWebhookOnSaleCheckedOut,
} from "../event-handlers/in-transaction/record-webhook-events.in-transaction-handlers";
import { InMemoryWebhooksStore, NOW, REWARD_ID, SequentialWebhookIds, TENANT_ID } from "./fakes/webhooks.fakes";

const CLAIM_ID = "0193f2c4-0000-7000-8000-0000000c1001";
const CLAIM = { claimId: CLAIM_ID, userId: "customer-1", rewardId: REWARD_ID, isReferrerCredit: false };
const REWARD = { rewardId: REWARD_ID, tenantId: TENANT_ID, title: "Free latte" };
const PAYMENT = {
	id: "0193f2c4-0000-7000-8000-0000000d1001",
	tenantId: TENANT_ID,
	provider: PaymentProviderNameSchema.enum.BILLPLZ,
	amountMinor: 2500,
	currency: PaymentCurrencySchema.enum.MYR,
	providerPaymentId: "bill-1",
};

describe("outgoing webhook producers", () => {
	let store: InMemoryWebhooksStore;
	let ids: SequentialWebhookIds;

	function recorded(): readonly { readonly type: string; readonly tenantId: string; readonly data: object }[] {
		return [...store.eventRows.values()].map((row) => ({ type: row.eventType, tenantId: row.tenantId, data: row.payload }));
	}

	beforeEach(() => {
		store = new InMemoryWebhooksStore();
		ids = new SequentialWebhookIds();
	});

	it("turns a reviewed or scheduled publication into reward.published, saying how", async () => {
		const handler = new RecordWebhookOnRewardReview(ids);
		await handler.handle(new RewardApproved(NOW, REWARD, "reviewer-1"), store.scope);
		await handler.handle(new RewardAutoPublished(NOW, REWARD), store.scope);

		expect(recorded()).toEqual([
			{ type: "reward.published", tenantId: TENANT_ID, data: { rewardId: REWARD_ID, title: "Free latte", via: "review" } },
			{ type: "reward.published", tenantId: TENANT_ID, data: { rewardId: REWARD_ID, title: "Free latte", via: "schedule" } },
		]);
		expect(store.eventNames()).toEqual(["webhooks.WebhookEventRecorded", "webhooks.WebhookEventRecorded"]);
	});

	it("turns a rejection into reward.rejected with the reviewer's reason", async () => {
		await new RecordWebhookOnRewardReview(ids).handle(new RewardRejected(NOW, REWARD, "reviewer-1", "Image too small"), store.scope);

		expect(recorded()).toEqual([{ type: "reward.rejected", tenantId: TENANT_ID, data: { rewardId: REWARD_ID, title: "Free latte", reason: "Image too small" } }]);
	});

	it("records claims under their reward's tenant, and never the customer", async () => {
		const handler = new RecordWebhookOnClaim(ids);
		await handler.handle(new RewardClaimed(NOW, CLAIM), store.scope);
		await handler.handle(new ClaimRedeemed(NOW, CLAIM), store.scope);
		await handler.handle(new ClaimExpired(NOW, CLAIM, TENANT_ID), store.scope);

		expect(recorded().map((event) => event.type)).toEqual(["claim.created", "claim.redeemed", "claim.expired"]);
		expect(recorded().every((event) => event.tenantId === TENANT_ID)).toBe(true);
		expect(JSON.stringify(recorded())).not.toContain("customer-1");
	});

	it("records nothing for a claim whose reward is gone", async () => {
		store.rewardTenants.clear();
		await new RecordWebhookOnClaim(ids).handle(new RewardClaimed(NOW, CLAIM), store.scope);

		expect(store.eventRows.size).toBe(0);
	});

	it("turns a checkout into sale.completed without the customer", async () => {
		await new RecordWebhookOnSaleCheckedOut(ids).handle(
			new SaleCheckedOut(NOW, "0193f2c4-0000-7000-8000-0000000e1001", TENANT_ID, "customer-1", null, "TERM-1", 2500, "MYR", [CLAIM_ID]),
			store.scope,
		);

		expect(recorded()).toEqual([
			{
				type: "sale.completed",
				tenantId: TENANT_ID,
				data: { saleId: "0193f2c4-0000-7000-8000-0000000e1001", locationId: null, terminalId: "TERM-1", billTotalMinor: 2500, currency: "MYR", claimIds: [CLAIM_ID] },
			},
		]);
	});

	it("maps each settled payment status to its event, without the payer", async () => {
		const handler = new RecordWebhookOnPaymentStatusChanged(ids);
		await handler.handle(new PaymentStatusChanged(NOW, PAYMENT, epochMs(NOW), "PAID"), store.scope);
		await handler.handle(new PaymentStatusChanged(NOW, PAYMENT, null, "FAILED"), store.scope);
		await handler.handle(new PaymentStatusChanged(NOW, PAYMENT, epochMs(NOW), "REFUNDED"), store.scope);

		expect(recorded().map((event) => event.type)).toEqual(["payment.succeeded", "payment.failed", "payment.refunded"]);
		expect(recorded().at(0)?.data).toEqual({ paymentId: PAYMENT.id, provider: "BILLPLZ", amountMinor: 2500, currency: "MYR", providerPaymentId: "bill-1", paidAt: NOW });
	});

	it("accepts only its own producer's events", () => {
		expect(new RecordWebhookOnSaleCheckedOut(ids).accepts(new RewardAutoPublished(NOW, REWARD))).toBe(false);
		expect(new RecordWebhookOnClaim(ids).accepts(new ClaimRedeemed(NOW, CLAIM))).toBe(true);
	});
});
