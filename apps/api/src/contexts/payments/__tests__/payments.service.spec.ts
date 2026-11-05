import { ActorContextSchema, type ActorContext } from "../../../platform/application/actor-context";
import type { Clock } from "../../../platform/application/clock.port";
import { describe, expect, it } from "vitest";
import { toPaginatedServiceResult } from "../../../platform/infrastructure/persistence/list-page";

import { epochMs, PaymentProviderNameSchema, type PaginatedServiceResult, type PaymentIntentListQuery, type PaymentProviderName } from "@workspace/shared";

import { FakeMerchantAccessPort } from "../../../platform/application/__tests__/fakes/fake-merchant-access.port";
import { InMemoryUnitOfWork } from "../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { PaymentStatusChanged } from "../domain/events/payment.events";
import { RecordingEventCollector } from "../../../platform/application/__tests__/fakes/recording-event-collector";
import type { PaymentIntent } from "../domain/aggregates/payment-intent.aggregate";
import { PaymentNotRefundableError } from "../domain/errors/payments.errors";
import type { NewPaymentEvent, OpenPaymentRef, PaymentIntentRepository } from "../domain/repositories/payment-intent.repository";
import { FakePaymentProvider } from "../infrastructure/providers/fake.provider";
import type { PaymentsScope } from "../application/payments-scope";
import type {
	CheckoutRequest,
	CheckoutSession,
	PaymentProviderPort,
	ProviderCallback,
	ProviderPaymentUpdate,
	RefundOutcome,
} from "../application/ports/payment-provider.port";
import type { PaymentProvidersPort } from "../application/ports/payment-providers.port";
import { paymentCallbackPath, PaymentsService, RECONCILE_AFTER_MS } from "../application/services/payments.service";

const TENANT = "0193f2c4-0000-7000-8000-0000000000a1";
const NOW = 1_793_664_000_000;
const RETURN = "https://merchant.example.com/t/kl/payments/return";
const INPUT = {
	provider: "FAKE",
	amountMinor: 1_500,
	currency: "MYR",
	description: "Order 42",
	payerName: "Aisyah",
	payerEmail: "aisyah@example.com",
	returnUrl: RETURN,
} satisfies Parameters<PaymentsService["create"]>[3];

const OWNER: ActorContext = ActorContextSchema.parse({
	kind: "user",
	userId: "owner-1",
	sessionId: "session-1",
	tenantId: TENANT,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "corr-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
});
const GATEWAY: ActorContext = ActorContextSchema.parse({
	kind: "anonymous",
	tenantId: null,
	request: { requestId: "corr-2", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
});

/** Payments in memory, with the same lookups the Prisma repository has. */
class InMemoryPayments implements PaymentIntentRepository {
	public readonly rows = new Map<string, PaymentIntent>();
	public readonly events: NewPaymentEvent[] = [];

	public findById(tenantId: string, id: string): Promise<PaymentIntent | null> {
		const row = this.rows.get(id);
		return Promise.resolve(row?.snapshot.tenantId === tenantId ? row : null);
	}

	public list(tenantId: string, query: PaymentIntentListQuery): Promise<PaginatedServiceResult<PaymentIntent>> {
		const items = [...this.rows.values()].filter((row) => row.snapshot.tenantId === tenantId);
		return Promise.resolve(toPaginatedServiceResult({ items, total: items.length, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false }, query));
	}

	public findByIdempotencyKey(tenantId: string, key: string): Promise<PaymentIntent | null> {
		return Promise.resolve([...this.rows.values()].find((row) => row.snapshot.tenantId === tenantId && row.snapshot.idempotencyKey === key) ?? null);
	}

	public findByProviderPaymentId(provider: PaymentProviderName, providerPaymentId: string): Promise<PaymentIntent | null> {
		return Promise.resolve([...this.rows.values()].find((row) => row.snapshot.provider === provider && row.snapshot.providerPaymentId === providerPaymentId) ?? null);
	}

	public insert(intent: PaymentIntent): Promise<void> {
		this.rows.set(intent.snapshot.id, intent);
		return Promise.resolve();
	}

	public update(intent: PaymentIntent): Promise<void> {
		this.rows.set(intent.snapshot.id, intent);
		return Promise.resolve();
	}

	public appendEvent(event: NewPaymentEvent): Promise<void> {
		this.events.push(event);
		return Promise.resolve();
	}

	public listOpenTouchedBetween(from: number, to: number): Promise<readonly OpenPaymentRef[]> {
		return Promise.resolve(
			[...this.rows.values()]
				.filter(
					(row) =>
						(row.snapshot.status === "PENDING" || row.snapshot.status === "FAILED") &&
						row.snapshot.providerPaymentId !== null &&
						row.snapshot.updatedAt >= from &&
						row.snapshot.updatedAt <= to,
				)
				.map((row) => ({ id: row.snapshot.id, provider: row.snapshot.provider, providerPaymentId: row.snapshot.providerPaymentId ?? "" })),
		);
	}
}

/** A gateway that refuses to open a checkout, or can't refund. */
class RefusingProvider implements PaymentProviderPort {
	public readonly name = "BILLPLZ";
	public createCheckout(_request: CheckoutRequest): Promise<CheckoutSession> {
		return Promise.reject(new Error("HTTP 422"));
	}
	public fetchStatus(_id: string): Promise<ProviderPaymentUpdate> {
		return Promise.reject(new Error("HTTP 503"));
	}
	public refund(): Promise<RefundOutcome> {
		return Promise.resolve({ kind: "unsupported" });
	}
	public readCallback(_callback: ProviderCallback): Promise<ProviderPaymentUpdate | null> {
		return Promise.resolve(null);
	}
}

interface Harness {
	readonly service: PaymentsService;
	readonly payments: InMemoryPayments;
	readonly fake: FakePaymentProvider;
	readonly access: FakeMerchantAccessPort;
	readonly events: RecordingEventCollector;
}

function harness(extra: Partial<Record<PaymentProviderName, PaymentProviderPort>> = {}): Harness {
	const payments = new InMemoryPayments();
	const fake = new FakePaymentProvider("fake-secret");
	const access = new FakeMerchantAccessPort();
	const clock: Clock = { now: () => epochMs(NOW) };
	let sequence = 0;
	const providers: PaymentProvidersPort = {
		get: (name: PaymentProviderName): PaymentProviderPort | null => (name === "FAKE" ? fake : (extra[name] ?? null)),
		configured: (): readonly PaymentProviderName[] =>
			PaymentProviderNameSchema.options.filter((name: PaymentProviderName): boolean => name === "FAKE" || extra[name] !== undefined),
	};
	const events = new RecordingEventCollector();
	const scope: PaymentsScope = { payments, events };
	const service = new PaymentsService({
		uow: new InMemoryUnitOfWork(scope),
		providers,
		merchantAccess: access,
		ids: { next: (): string => `id-${String((sequence += 1))}` },
		clock,
		returnOrigins: ["https://merchant.example.com", "https://example.com"],
		apiPublicUrl: "https://api.example.com",
	});
	return { service, payments, fake, access, events };
}

describe("PaymentsService.create", () => {
	it("checks the capability, opens a checkout at the gateway, and records it", async () => {
		const { service, payments, access } = harness();
		const payment = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		expect(access.requests.map((entry) => entry.request.capability)).toStrictEqual(["merchant:manage_payments"]);
		expect(payment).toMatchObject({ status: "PENDING", provider: "FAKE", amountMinor: 1_500, providerPaymentId: "fake_id-1", refundable: false });
		expect(payment.checkoutUrl).toContain("fake_payment=fake_id-1");
		expect(payments.events.map((event) => [event.source, event.effect])).toStrictEqual([["CHECKOUT", "UNCHANGED"]]);
	});

	it("returns the same payment for the same Idempotency-Key and request, and refuses the key for a different one", async () => {
		const { service, payments } = harness();
		const first = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		const again = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		expect(again.id).toBe(first.id);
		expect(payments.rows.size).toBe(1);
		await expect(service.create(OWNER, TENANT, "key-12345678", { ...INPUT, amountMinor: 9_999 })).rejects.toMatchObject({ details: { reason: "IDEMPOTENCY_KEY_REUSED" } });
	});

	it("never sends a payer to a site outside the platform, or through a gateway not set up here", async () => {
		const { service } = harness();
		await expect(service.create(OWNER, TENANT, "key-12345678", { ...INPUT, returnUrl: "https://evil.example.net/steal" })).rejects.toMatchObject({
			details: { field: "returnUrl" },
		});
		await expect(service.create(OWNER, TENANT, "key-12345678", { ...INPUT, provider: "CHIP" })).rejects.toMatchObject({ details: { provider: "CHIP" } });
	});

	it("closes the payment when the gateway refuses to open a checkout, and says so", async () => {
		const { service, payments } = harness({ BILLPLZ: new RefusingProvider() });
		await expect(service.create(OWNER, TENANT, "key-12345678", { ...INPUT, provider: "BILLPLZ" })).rejects.toThrow("HTTP 422");
		const [stored] = [...payments.rows.values()];
		expect(stored?.snapshot.status).toBe("CANCELLED");
		expect(payments.events.map((event) => event.providerStatus)).toStrictEqual(["checkout_failed"]);
	});

	it("refuses a member without the capability before touching the gateway", async () => {
		const { service, payments, access } = harness();
		access.deny("merchant:manage_payments");
		await expect(service.create(OWNER, TENANT, "key-12345678", INPUT)).rejects.toThrow();
		expect(payments.rows.size).toBe(0);
	});
});

describe("PaymentsService.applyCallback", () => {
	it("applies a verified callback once, and records repeats as unchanged", async () => {
		const { service, payments, fake } = harness();
		const created = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		const callback = fake.signedCallback(created.providerPaymentId ?? "", "PAID");
		await expect(service.applyCallback(GATEWAY, "FAKE", callback)).resolves.toBe("applied");
		await service.applyCallback(GATEWAY, "FAKE", callback);
		expect((await service.get(OWNER, TENANT, created.id)).status).toBe("PAID");
		expect(payments.events.filter((event) => event.source === "CALLBACK").map((event) => event.effect)).toStrictEqual(["APPLIED", "UNCHANGED"]);
	});

	it("rejects an unsigned callback, or one for a gateway that isn't configured, without changing anything", async () => {
		const { service, payments, fake } = harness();
		const created = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		const genuine = fake.signedCallback(created.providerPaymentId ?? "", "PAID");
		await expect(service.applyCallback(GATEWAY, "FAKE", { rawBody: genuine.rawBody, headers: {} })).resolves.toBe("rejected");
		await expect(service.applyCallback(GATEWAY, "CHIP", genuine)).resolves.toBe("rejected");
		expect((await service.get(OWNER, TENANT, created.id)).status).toBe("PENDING");
		expect(payments.events.filter((event) => event.source === "CALLBACK")).toStrictEqual([]);
	});

	it("never marks a payment paid when the gateway reports a different amount", async () => {
		const { service, payments } = harness();
		const created = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		const providerPaymentId = created.providerPaymentId ?? "";
		const tampered = Buffer.from(JSON.stringify({ id: providerPaymentId, reference: created.id, status: "PAID", amount: 1 }));
		const signed = { rawBody: tampered, headers: { "x-fake-signature": (await import("node:crypto")).createHmac("sha256", "fake-secret").update(tampered).digest("hex") } };
		await service.applyCallback(GATEWAY, "FAKE", signed);
		expect((await service.get(OWNER, TENANT, created.id)).status).toBe("PENDING");
		expect(payments.events.at(-1)).toMatchObject({ source: "CALLBACK", effect: "IGNORED", amountMinor: 1 });
	});

	it("acknowledges a verified callback for a payment it doesn't know (so the gateway stops retrying)", async () => {
		const { service, fake } = harness();
		await service.create(OWNER, TENANT, "key-12345678", INPUT);
		const other = await fake.createCheckout({
			paymentId: "elsewhere",
			amountMinor: 100,
			currency: "MYR",
			description: "x",
			payerName: "x",
			payerEmail: "x@example.com",
			returnUrl: RETURN,
			callbackUrl: RETURN,
		});
		await expect(service.applyCallback(GATEWAY, "FAKE", fake.signedCallback(other.providerPaymentId, "PAID"))).resolves.toBe("applied");
	});
});

describe("PaymentsService: settled payments announce themselves (outgoing webhooks, ADR 082)", () => {
	it("records PaymentStatusChanged once when a payment is paid, never for a repeat, and again when it is refunded", async () => {
		const { service, fake, events } = harness();
		const created = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		expect(events.recordedNames()).not.toContain("payments.PaymentStatusChanged");

		const callback = fake.signedCallback(created.providerPaymentId ?? "", "PAID");
		await service.applyCallback(GATEWAY, "FAKE", callback);
		await service.applyCallback(GATEWAY, "FAKE", callback);
		await service.refund(OWNER, TENANT, created.id);

		const changes = events.recorded().filter((event): event is PaymentStatusChanged => event instanceof PaymentStatusChanged);
		expect(changes.map((event) => event.status)).toStrictEqual(["PAID", "REFUNDED"]);
		expect(changes.at(0)).toMatchObject({ paymentId: created.id, tenantId: TENANT, provider: "FAKE", amountMinor: 1_500, currency: "MYR" });
	});
});

describe("PaymentsService.refund", () => {
	it("refunds a paid payment through its gateway, and refuses one that isn't paid", async () => {
		const { service, fake } = harness();
		const created = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		await expect(service.refund(OWNER, TENANT, created.id)).rejects.toBeInstanceOf(PaymentNotRefundableError);
		await service.applyCallback(GATEWAY, "FAKE", fake.signedCallback(created.providerPaymentId ?? "", "PAID"));
		const refund = await service.refund(OWNER, TENANT, created.id);
		expect(refund).toMatchObject({ outcome: "refunded", payment: { status: "REFUNDED", refundable: false } });
	});
});

describe("PaymentsService.reconcile", () => {
	it("asks the gateway about payments open for a while, and applies what it says", async () => {
		const { service, payments, fake } = harness();
		const created = await service.create(OWNER, TENANT, "key-12345678", INPUT);
		// The payer paid, but the callback was lost; the payment was last touched long enough ago.
		fake.signedCallback(created.providerPaymentId ?? "", "PAID");
		const stored = payments.rows.get(created.id);
		if (stored === undefined) {
			throw new Error("missing payment");
		}
		const { PaymentIntent } = await import("../domain/aggregates/payment-intent.aggregate");
		payments.rows.set(created.id, PaymentIntent.restore({ ...stored.snapshot, updatedAt: NOW - RECONCILE_AFTER_MS - 1 }));
		await expect(service.reconcile(GATEWAY)).resolves.toStrictEqual({ checked: 1, changed: 1, failed: 0 });
		expect(payments.rows.get(created.id)?.snapshot.status).toBe("PAID");
		expect(payments.events.at(-1)).toMatchObject({ source: "RECONCILE", effect: "APPLIED" });
	});
});

describe("PaymentsService.availableProviders", () => {
	it("names the configured gateways and whether each refunds, for a member with the capability", async () => {
		const { service, access } = harness({ BILLPLZ: new RefusingProvider() });
		await expect(service.availableProviders(OWNER, TENANT)).resolves.toStrictEqual({
			providers: [
				{ name: "BILLPLZ", refunds: false },
				{ name: "FAKE", refunds: true },
			],
		});
		access.deny("merchant:manage_payments");
		await expect(service.availableProviders(OWNER, TENANT)).rejects.toThrow();
	});
});

describe("paymentCallbackPath", () => {
	it("is the gateway's public callback route", () => {
		expect(paymentCallbackPath("BILLPLZ")).toMatch(/\/payments\/callbacks\/billplz$/u);
		expect(paymentCallbackPath("CHIP")).toMatch(/\/payments\/callbacks\/chip$/u);
	});
});
