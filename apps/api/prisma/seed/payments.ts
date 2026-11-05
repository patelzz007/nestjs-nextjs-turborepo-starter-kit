import { DAY_MS } from "@workspace/shared";
import type { PaymentEventEffect, PaymentEventSource, PaymentProvider, PaymentStatus } from "@prisma/client";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { REWARD_SEED_IDS } from "./rewards";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";

const NAMESPACE = "seed.payments";
/** The seeded history spaces its events a minute apart. */
const MINUTE_MS = 60_000;

/** One seeded payment: its gateway, where it ended, and how many days before the seed run it was asked for. */
interface SeedPayment {
	readonly key: string;
	readonly provider: PaymentProvider;
	readonly status: PaymentStatus;
	readonly amountMinor: number;
	readonly description: string;
	readonly payer: { readonly name: string; readonly email: string };
	readonly daysAgo: number;
	/** The gateway's status words, in the order its news arrived (each becomes an event). */
	readonly history: readonly { readonly source: PaymentEventSource; readonly providerStatus: string; readonly status: PaymentStatus; readonly effect: PaymentEventEffect }[];
	readonly deleted?: boolean;
}

/**
 * Brew & Bean KL's payments (ADR 020): one per status and gateway, each with the history a real one would
 * have (checkout, callbacks, a late duplicate, a reconciliation, a refund), and one soft-deleted, so every
 * column of `PaymentIntent` and `PaymentEvent` holds data and the payments page has every state to show.
 * Re-running converges (rows are upserted by id).
 */
const PAYMENTS: readonly SeedPayment[] = [
	{
		key: "paid-chip",
		provider: "CHIP",
		status: "PAID",
		amountMinor: 4_500,
		description: "Catering deposit, Saturday 9 Nov",
		payer: { name: "Nur Aisyah", email: "aisyah.demo@example.com" },
		daysAgo: 6,
		history: [
			{ source: "CHECKOUT", providerStatus: "created", status: "PENDING", effect: "UNCHANGED" },
			{ source: "CALLBACK", providerStatus: "paid", status: "PAID", effect: "APPLIED" },
			// The gateway retried its callback: the repeat changed nothing.
			{ source: "CALLBACK", providerStatus: "paid", status: "PAID", effect: "UNCHANGED" },
		],
	},
	{
		key: "pending-billplz",
		provider: "BILLPLZ",
		status: "PENDING",
		amountMinor: 1_200,
		description: "Gift card RM 12",
		payer: { name: "Tan Wei Ling", email: "weiling.demo@example.com" },
		daysAgo: 0,
		history: [{ source: "CHECKOUT", providerStatus: "due", status: "PENDING", effect: "UNCHANGED" }],
	},
	{
		key: "failed-chip",
		provider: "CHIP",
		status: "FAILED",
		amountMinor: 9_900,
		description: "Monthly coffee subscription",
		payer: { name: "Arun Kumar", email: "arun.demo@example.com" },
		daysAgo: 3,
		history: [
			{ source: "CHECKOUT", providerStatus: "created", status: "PENDING", effect: "UNCHANGED" },
			{ source: "RECONCILE", providerStatus: "error", status: "FAILED", effect: "APPLIED" },
		],
	},
	{
		key: "cancelled-billplz",
		provider: "BILLPLZ",
		status: "CANCELLED",
		amountMinor: 3_000,
		description: "Barista workshop seat",
		payer: { name: "Siti Rahman", email: "siti.demo@example.com" },
		daysAgo: 12,
		history: [
			{ source: "CHECKOUT", providerStatus: "due", status: "PENDING", effect: "UNCHANGED" },
			{ source: "RECONCILE", providerStatus: "deleted", status: "CANCELLED", effect: "APPLIED" },
			// A late "due" from an old redirect: ignored, a cancelled payment stays cancelled.
			{ source: "CALLBACK", providerStatus: "due", status: "PENDING", effect: "IGNORED" },
		],
	},
	{
		key: "refunded-chip",
		provider: "CHIP",
		status: "REFUNDED",
		amountMinor: 2_500,
		description: "Cake order (cancelled by the shop)",
		payer: { name: "Lim Jia Hui", email: "jiahui.demo@example.com" },
		daysAgo: 20,
		history: [
			{ source: "CHECKOUT", providerStatus: "created", status: "PENDING", effect: "UNCHANGED" },
			{ source: "CALLBACK", providerStatus: "paid", status: "PAID", effect: "APPLIED" },
			{ source: "REFUND", providerStatus: "refunded", status: "REFUNDED", effect: "APPLIED" },
		],
	},
	{
		key: "paid-fake-deleted",
		provider: "FAKE",
		status: "PAID",
		amountMinor: 100,
		description: "Test payment (removed)",
		payer: { name: "Test Payer", email: "test.payer@example.com" },
		daysAgo: 30,
		history: [{ source: "CALLBACK", providerStatus: "PAID", status: "PAID", effect: "APPLIED" }],
		deleted: true,
	},
];

/** Gateway-side ids as the gateways write them: Billplz bill ids are short, CHIP's are UUIDs. */
function providerPaymentIdOf(payment: SeedPayment): string {
	return payment.provider === "BILLPLZ" ? `bp_${payment.key.replaceAll("-", "").slice(0, 8)}` : deterministicUuid(NAMESPACE, `gateway:${payment.key}`);
}

function checkoutUrlOf(payment: SeedPayment, providerPaymentId: string): string | null {
	if (payment.status !== "PENDING") {
		return null;
	}
	return payment.provider === "BILLPLZ" ? `https://www.billplz-sandbox.com/bills/${providerPaymentId}` : `https://gate.chip-in.asia/p/${providerPaymentId}/`;
}

export async function seedPayments(now: number): Promise<{ readonly payments: number; readonly events: number }> {
	const tenantId = TENANT_SEED_IDS.klTenant;
	const actor = REWARD_SEED_IDS.klOwnerUser;
	let events = 0;
	for (const payment of PAYMENTS) {
		const id = deterministicUuid(NAMESPACE, payment.key);
		const createdAt = now - payment.daysAgo * DAY_MS;
		const providerPaymentId = providerPaymentIdOf(payment);
		const paidStep = payment.history.findIndex((step) => step.status === "PAID" && step.effect === "APPLIED");
		const row = {
			tenantId,
			provider: payment.provider,
			status: payment.status,
			amountMinor: payment.amountMinor,
			currency: "MYR",
			description: payment.description,
			payerName: payment.payer.name,
			payerEmail: payment.payer.email,
			idempotencyKey: `seed-${payment.key}`,
			providerPaymentId,
			checkoutUrl: checkoutUrlOf(payment, providerPaymentId),
			paidAt: paidStep === -1 ? null : BigInt(createdAt + (paidStep + 1) * MINUTE_MS),
			createdAt: BigInt(createdAt),
			createdBy: actor,
			updatedAt: BigInt(createdAt + payment.history.length * MINUTE_MS),
			updatedBy: actor,
			isDeleted: payment.deleted === true,
			deletedAt: payment.deleted === true ? BigInt(createdAt + DAY_MS) : null,
			deletedBy: payment.deleted === true ? actor : null,
		};
		await prisma.paymentIntent.upsert({ where: { id }, create: { id, ...row }, update: row });
		for (const [index, step] of payment.history.entries()) {
			const eventId = deterministicUuid(NAMESPACE, `${payment.key}:event:${String(index)}`);
			const occurredAt = BigInt(createdAt + index * MINUTE_MS);
			const event = {
				tenantId,
				paymentIntentId: id,
				source: step.source,
				providerStatus: step.providerStatus,
				status: step.status,
				effect: step.effect,
				amountMinor: step.source === "CHECKOUT" ? null : payment.amountMinor,
				occurredAt,
				createdAt: occurredAt,
				createdBy: step.source === "CALLBACK" || step.source === "RECONCILE" ? `system:payments.${step.source.toLowerCase()}` : actor,
				updatedAt: occurredAt,
				updatedBy: null,
				isDeleted: false,
				deletedAt: null,
				deletedBy: null,
			};
			// Append-only table: written once (create), never updated by a re-run.
			await prisma.paymentEvent.upsert({ where: { id: eventId }, create: { id: eventId, ...event }, update: {} });
			events += 1;
		}
	}
	return { payments: PAYMENTS.length, events };
}
