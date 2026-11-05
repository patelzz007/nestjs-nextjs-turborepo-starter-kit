import { Logger } from "@nestjs/common";
import {
	apiPath,
	epochMs,
	MERCHANT_CAPABILITY,
	PAYMENT_PROVIDER_REFUNDS,
	PaymentStatusSchema,
	type CreatePaymentIntent,
	type PaginatedServiceResult,
	type PaymentIntentListQuery,
	type PaymentIntentResponse,
	type PaymentProviderName,
	type PaymentProvidersResponse,
	type PaymentRefundResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { ConflictError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessPort } from "../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { PaymentIntent } from "../../domain/aggregates/payment-intent.aggregate";
import { PaymentStatusChanged } from "../../domain/events/payment.events";
import type { PaymentEventEffect, PaymentEventSource } from "../../domain/repositories/payment-intent.repository";
import type { PaymentsScope } from "../payments-scope";
import type { CheckoutSession, PaymentProviderPort, ProviderCallback, ProviderPaymentUpdate } from "../ports/payment-provider.port";
import type { PaymentIdsPort } from "../ports/payment-ids.port";
import type { PaymentProvidersPort } from "../ports/payment-providers.port";
import { PAYMENT_CALLBACK_OPERATION, PAYMENT_CREATE_OPERATION, PAYMENT_RECONCILE_OPERATION, PAYMENT_REFUND_OPERATION } from "../payments.tokens";

/** How long a payment may stay open before reconciliation asks its gateway (a lost callback). */
export const RECONCILE_AFTER_MS = 15 * 60_000;
/** Older open payments are left alone (an abandoned checkout); the gateway's own expiry closes them. */
export const RECONCILE_WITHIN_MS = 7 * 24 * 60 * 60_000;
/** Payments asked about per reconciliation run. */
export const RECONCILE_BATCH = 50;

export interface PaymentsServiceDependencies {
	readonly uow: UnitOfWork<PaymentsScope>;
	readonly providers: PaymentProvidersPort;
	readonly merchantAccess: MerchantAccessPort;
	readonly ids: PaymentIdsPort;
	readonly clock: Clock;
	/** Origins a payer may be returned to: the platform's own apps. */
	readonly returnOrigins: readonly string[];
	/** The API's public base URL, for the gateways' callbacks. */
	readonly apiPublicUrl: string;
}

/** The result of one reconciliation run. */
export interface ReconciliationRun {
	readonly checked: number;
	readonly changed: number;
	readonly failed: number;
}

/** What a payment looks like to its tenant. */
export function toPaymentIntentResponse(intent: PaymentIntent): PaymentIntentResponse {
	const s = intent.snapshot;
	return {
		id: s.id,
		tenantId: s.tenantId,
		provider: s.provider,
		status: s.status,
		amountMinor: s.amountMinor,
		currency: s.currency,
		description: s.description,
		payerName: s.payerName,
		payerEmail: s.payerEmail,
		checkoutUrl: s.status === "PENDING" || s.status === "FAILED" ? s.checkoutUrl : null,
		providerPaymentId: s.providerPaymentId,
		paidAt: s.paidAt === null ? null : epochMs(s.paidAt),
		refundable: s.status === "PAID" && PAYMENT_PROVIDER_REFUNDS[s.provider],
		createdAt: epochMs(s.createdAt),
		updatedAt: epochMs(s.updatedAt),
		isDeleted: false,
		deletedAt: null,
	};
}

/** The callback path of each gateway (the public route, without the host). */
export function paymentCallbackPath(provider: PaymentProviderName): string {
	return `${apiPath("/payments/callbacks")}/${provider.toLowerCase()}`;
}

/**
 * Payments through the tenant's gateways (ADR 020). Gateways are called OUTSIDE database transactions (a slow
 * gateway never holds a connection); every change is a short transaction under its own system operation,
 * recording an event. Status news from any source goes through the aggregate's policy, so callbacks, redirects
 * and reconciliation can arrive in any order, any number of times.
 */
export class PaymentsService {
	private readonly logger: Logger = new Logger(PaymentsService.name);

	public constructor(private readonly deps: PaymentsServiceDependencies) {}

	/** Asks for a payment. The same `Idempotency-Key` with the same request returns the same payment. */
	public async create(actor: ActorContext, tenantId: string, idempotencyKey: string, input: CreatePaymentIntent): Promise<PaymentIntentResponse> {
		await this.deps.merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.managePayments });
		this.assertReturnUrl(input.returnUrl);
		const provider = this.requireProvider(input.provider);
		const request = {
			provider: input.provider,
			amountMinor: input.amountMinor,
			currency: input.currency,
			description: input.description,
			payerName: input.payerName,
			payerEmail: input.payerEmail,
		};
		const actorId = actorIdOf(actor);
		const opened = await this.deps.uow.runSystemOperation(
			PAYMENT_CREATE_OPERATION,
			actor,
			async (scope: PaymentsScope): Promise<{ readonly intent: PaymentIntent; readonly isNew: boolean }> => {
				const existing = await scope.payments.findByIdempotencyKey(tenantId, idempotencyKey);
				if (existing !== null) {
					if (!existing.isSameRequestAs(request)) {
						throw new ConflictError({ message: "This Idempotency-Key was used for a different payment.", details: { reason: "IDEMPOTENCY_KEY_REUSED" } });
					}
					return { intent: existing, isNew: false };
				}
				const intent = PaymentIntent.create({ id: this.deps.ids.next(), tenantId, idempotencyKey, ...request }, this.deps.clock.now());
				await scope.payments.insert(intent, actorId);
				return { intent, isNew: true };
			},
		);
		if (!opened.isNew) {
			return toPaymentIntentResponse(opened.intent);
		}
		const intent = opened.intent;
		let session: CheckoutSession;
		try {
			session = await provider.createCheckout({
				paymentId: intent.snapshot.id,
				amountMinor: request.amountMinor,
				currency: request.currency,
				description: request.description,
				payerName: request.payerName,
				payerEmail: request.payerEmail,
				returnUrl: input.returnUrl,
				callbackUrl: `${this.deps.apiPublicUrl}${paymentCallbackPath(input.provider)}`,
			});
		} catch (error: unknown) {
			// The gateway refused or failed: the payment can never be paid, so it is closed, and the caller told.
			await this.record(PAYMENT_CREATE_OPERATION, actor, tenantId, intent.snapshot.id, "CHECKOUT", {
				providerStatus: "checkout_failed",
				status: "CANCELLED",
				amountMinor: null,
			});
			throw error;
		}
		return this.deps.uow.runSystemOperation(PAYMENT_CREATE_OPERATION, actor, async (scope: PaymentsScope): Promise<PaymentIntentResponse> => {
			const stored = await this.requireIntent(scope, tenantId, intent.snapshot.id);
			const now = this.deps.clock.now();
			stored.attachCheckout(session.providerPaymentId, session.checkoutUrl, now);
			await scope.payments.update(stored, actorId);
			await this.appendEvent(scope, stored, "CHECKOUT", "created", "UNCHANGED", null, now, actorId);
			return toPaymentIntentResponse(stored);
		});
	}

	/** The gateways a payment can be asked for through here, and whether each refunds through its API. */
	public async availableProviders(actor: ActorContext, tenantId: string): Promise<PaymentProvidersResponse> {
		await this.deps.merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.managePayments });
		return { providers: this.deps.providers.configured().map((name: PaymentProviderName) => ({ name, refunds: PAYMENT_PROVIDER_REFUNDS[name] })) };
	}

	public async list(actor: ActorContext, tenantId: string, query: PaymentIntentListQuery): Promise<PaginatedServiceResult<PaymentIntentResponse>> {
		await this.deps.merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.managePayments });
		const page = await this.deps.uow.run(actor, (scope: PaymentsScope) => scope.payments.list(tenantId, query));
		return { ...page, items: page.items.map(toPaymentIntentResponse) };
	}

	public async get(actor: ActorContext, tenantId: string, paymentId: string): Promise<PaymentIntentResponse> {
		await this.deps.merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.managePayments });
		return this.deps.uow.run(actor, async (scope: PaymentsScope): Promise<PaymentIntentResponse> =>
			toPaymentIntentResponse(await this.requireIntent(scope, tenantId, paymentId)),
		);
	}

	/** Refunds a paid payment through its gateway (CHIP); Billplz refunds only in its dashboard. */
	public async refund(actor: ActorContext, tenantId: string, paymentId: string): Promise<PaymentRefundResponse> {
		await this.deps.merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.managePayments });
		const intent = await this.deps.uow.runSystemOperation(PAYMENT_REFUND_OPERATION, actor, (scope: PaymentsScope) => this.requireIntent(scope, tenantId, paymentId));
		intent.assertRefundable();
		const { provider, providerPaymentId, amountMinor } = intent.snapshot;
		if (providerPaymentId === null) {
			throw new ValidationError({ message: "This payment never reached its gateway." });
		}
		const outcome = await this.requireProvider(provider).refund(providerPaymentId, amountMinor);
		if (outcome.kind === "unsupported") {
			throw new ValidationError({ message: "This gateway refunds only in its own dashboard.", details: { provider } });
		}
		const status = outcome.kind === "refunded" ? "REFUNDED" : "PAID";
		const payment = await this.record(PAYMENT_REFUND_OPERATION, actor, tenantId, paymentId, "REFUND", {
			providerStatus: outcome.kind === "refunded" ? "refunded" : "pending_refund",
			status,
			amountMinor,
		});
		return { outcome: outcome.kind, payment };
	}

	/**
	 * A gateway's callback. Its signature is verified first (`null` → the caller answers 401 and nothing changes);
	 * a callback for a payment this platform doesn't know, or whose amount differs from the payment's, changes
	 * nothing either (the second is logged as an error: it would be a tampered or mismatched payment).
	 */
	public async applyCallback(actor: ActorContext, providerName: PaymentProviderName, callback: ProviderCallback): Promise<"applied" | "rejected"> {
		const provider = this.deps.providers.get(providerName);
		const update = provider === null ? null : await provider.readCallback(callback);
		if (update === null) {
			return "rejected";
		}
		await this.applyUpdate(PAYMENT_CALLBACK_OPERATION, actor, providerName, update, "CALLBACK");
		return "applied";
	}

	/** Asks the gateways about payments still open after a while (a lost or late callback). */
	public async reconcile(actor: ActorContext): Promise<ReconciliationRun> {
		const now = this.deps.clock.now();
		const open = await this.deps.uow.runSystemOperation(PAYMENT_RECONCILE_OPERATION, actor, (scope: PaymentsScope) =>
			scope.payments.listOpenTouchedBetween(now - RECONCILE_WITHIN_MS, now - RECONCILE_AFTER_MS, RECONCILE_BATCH),
		);
		let changed = 0;
		let failed = 0;
		for (const payment of open) {
			const provider = this.deps.providers.get(payment.provider);
			if (provider === null) {
				continue;
			}
			try {
				const update = await provider.fetchStatus(payment.providerPaymentId);
				if ((await this.applyUpdate(PAYMENT_RECONCILE_OPERATION, actor, payment.provider, update, "RECONCILE")) === "APPLIED") {
					changed += 1;
				}
			} catch (error: unknown) {
				failed += 1;
				this.logger.warn({
					event: "payments.reconcile.failed",
					paymentId: payment.id,
					provider: payment.provider,
					reason: error instanceof Error ? error.message : "unknown",
				});
			}
		}
		return { checked: open.length, changed, failed };
	}

	private async applyUpdate(
		operation: typeof PAYMENT_CALLBACK_OPERATION,
		actor: ActorContext,
		providerName: PaymentProviderName,
		update: ProviderPaymentUpdate,
		source: PaymentEventSource,
	): Promise<PaymentEventEffect | "UNKNOWN"> {
		return this.deps.uow.runSystemOperation(operation, actor, async (scope: PaymentsScope): Promise<PaymentEventEffect | "UNKNOWN"> => {
			const intent = await scope.payments.findByProviderPaymentId(providerName, update.providerPaymentId);
			if (intent === null) {
				this.logger.warn({ event: "payments.callback.unknown_payment", provider: providerName, providerPaymentId: update.providerPaymentId });
				return "UNKNOWN";
			}
			const now = this.deps.clock.now();
			const amountMismatch = update.status === "PAID" && update.amountMinor !== null && update.amountMinor !== intent.snapshot.amountMinor;
			if (amountMismatch) {
				this.logger.error({ event: "payments.callback.amount_mismatch", paymentId: intent.snapshot.id, expected: intent.snapshot.amountMinor, reported: update.amountMinor });
			}
			const effect: PaymentEventEffect = amountMismatch ? "IGNORED" : effectOf(intent.applyProviderStatus(update.status, now));
			if (effect === "APPLIED") {
				await scope.payments.update(intent, systemActorIdOf(source));
				collectSettledPayment(scope, intent, now);
			}
			await this.appendEvent(scope, intent, source, update.providerStatus, effect, update.amountMinor, now, systemActorIdOf(source), update.status);
			return effect;
		});
	}

	/** Applies a status the platform itself decided (a refused checkout, a refund) and records it. */
	private async record(
		operation: typeof PAYMENT_CREATE_OPERATION,
		actor: ActorContext,
		tenantId: string,
		paymentId: string,
		source: PaymentEventSource,
		news: { readonly providerStatus: string; readonly status: "CANCELLED" | "REFUNDED" | "PAID"; readonly amountMinor: number | null },
	): Promise<PaymentIntentResponse> {
		return this.deps.uow.runSystemOperation(operation, actor, async (scope: PaymentsScope): Promise<PaymentIntentResponse> => {
			const intent = await this.requireIntent(scope, tenantId, paymentId);
			const now = this.deps.clock.now();
			const effect = effectOf(intent.applyProviderStatus(news.status, now));
			if (effect === "APPLIED") {
				await scope.payments.update(intent, actorIdOf(actor));
				collectSettledPayment(scope, intent, now);
			}
			await this.appendEvent(scope, intent, source, news.providerStatus, effect, news.amountMinor, now, actorIdOf(actor), news.status);
			return toPaymentIntentResponse(intent);
		});
	}

	private async appendEvent(
		scope: PaymentsScope,
		intent: PaymentIntent,
		source: PaymentEventSource,
		providerStatus: string,
		effect: PaymentEventEffect,
		amountMinor: number | null,
		now: number,
		actor: string,
		reportedStatus = intent.snapshot.status,
	): Promise<void> {
		await scope.payments.appendEvent({
			id: this.deps.ids.next(),
			tenantId: intent.snapshot.tenantId,
			paymentIntentId: intent.snapshot.id,
			source,
			providerStatus,
			status: reportedStatus,
			effect,
			amountMinor,
			occurredAt: now,
			actor,
		});
	}

	private async requireIntent(scope: PaymentsScope, tenantId: string, paymentId: string): Promise<PaymentIntent> {
		const intent = await scope.payments.findById(tenantId, paymentId);
		if (intent === null) {
			throw new NotFoundError({ message: "Payment not found." });
		}
		return intent;
	}

	private requireProvider(name: PaymentProviderName): PaymentProviderPort {
		const provider = this.deps.providers.get(name);
		if (provider === null) {
			throw new ValidationError({ message: "This payment gateway isn't set up on this platform.", details: { provider: name } });
		}
		return provider;
	}

	/** The payer may only be sent back to one of the platform's own apps (no open redirect through a gateway). */
	private assertReturnUrl(returnUrl: string): void {
		if (!this.deps.returnOrigins.includes(new URL(returnUrl).origin)) {
			throw new ValidationError({ message: "The return address must be a page of this platform.", details: { field: "returnUrl" } });
		}
	}
}

function effectOf(change: "applied" | "unchanged" | "ignored"): PaymentEventEffect {
	switch (change) {
		case "applied":
			return "APPLIED";
		case "unchanged":
			return "UNCHANGED";
		case "ignored":
			return "IGNORED";
	}
}

/** Who is recorded as making a change: the signed-in user, else the system operation's origin. */
function actorIdOf(actor: ActorContext): string {
	return actor.kind === "user" ? actor.userId : "system:payments";
}

function systemActorIdOf(source: PaymentEventSource): string {
	return `system:payments.${source.toLowerCase()}`;
}

/** The statuses that settle a payment: each is announced once, when it is applied (ADR 082's payment webhooks). */
const SettledPaymentStatusSchema = PaymentStatusSchema.extract(["PAID", "FAILED", "REFUNDED"]);

/** Records `PaymentStatusChanged` for a change that just applied, when it settles the payment. */
function collectSettledPayment(scope: PaymentsScope, intent: PaymentIntent, now: number): void {
	const { snapshot } = intent;
	const settled = SettledPaymentStatusSchema.safeParse(snapshot.status);
	if (!settled.success) {
		return;
	}
	scope.events.collect(new PaymentStatusChanged(epochMs(now), snapshot, snapshot.paidAt === null ? null : epochMs(snapshot.paidAt), settled.data));
}
