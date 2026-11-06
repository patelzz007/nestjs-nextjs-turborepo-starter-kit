import { createHmac, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, PaymentIntentResponseSchema, PaymentProvidersResponseSchema, PaymentRefundResponseSchema } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, mutationHeaders, parsePaginatedEnvelope, parseSuccessEnvelope, type InjectResponse, type LoginResult, uniqueClientIp } from "./e2e-helpers";
import { TEST_E2E_PAYMENTS } from "./support/test-api-env";

const KL = TENANT_SEED_SLUGS.kl;
const MLK = TENANT_SEED_SLUGS.mlk;
const FAKE_SECRET = z.string().parse(TEST_E2E_PAYMENTS.PAYMENTS_FAKE_SECRET);
const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });

/** A payment request as the merchant portal sends it. */
function paymentRequest(overrides: Record<string, string | number> = {}): Record<string, string | number> {
	return {
		provider: "FAKE",
		amountMinor: 2_500,
		description: "E2E order",
		payerName: "E2E Payer",
		payerEmail: "payer@example.com",
		returnUrl: "http://localhost:3003/payments/return",
		...overrides,
	};
}

/** The fake gateway's callback for a payment, signed like the real fake adapter signs it. */
function fakeCallback(providerPaymentId: string, paymentId: string, status: string, amount: number): { readonly body: string; readonly signature: string } {
	const body = JSON.stringify({ id: providerPaymentId, reference: paymentId, status, amount });
	return { body, signature: createHmac("sha256", FAKE_SECRET).update(body).digest("hex") };
}

/**
 * Payments over HTTP (ADR 020) with the fake gateway: an owner asks for a payment, the same Idempotency-Key
 * gives the same payment, a signed callback marks it paid (repeats change nothing), an unsigned one is
 * refused, the owner refunds it, and another tenant can't see it.
 */
describe("Payments (e2e)", () => {
	let app: NestFastifyApplication;
	let owner: LoginResult;
	let otherOwner: LoginResult;

	function merchantHeaders(user: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${user.accessToken}; merchantRefreshToken=${user.refreshToken}`, "x-client-type": "merchant", "x-forwarded-for": uniqueClientIp() };
	}

	function create(user: LoginResult, slug: string, idempotencyKey: string | null, payload = paymentRequest()): Promise<InjectResponse> {
		const headers = mutationHeaders(merchantHeaders(user));
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/tenants/${slug}/payments`,
			headers: idempotencyKey === null ? headers : { ...headers, "idempotency-key": idempotencyKey },
			payload,
		});
	}

	function callback(body: string, signature: string | null): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/payments/callbacks/fake`,
			headers: { "content-type": "application/json", "x-forwarded-for": uniqueClientIp(), ...(signature === null ? {} : { "x-fake-signature": signature }) },
			payload: body,
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		otherOwner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
	});

	afterAll(async () => {
		await app.close();
	});

	it("names the gateways set up here (the fake one under tests)", async () => {
		const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${KL}/payments/providers`, headers: merchantHeaders(owner) });
		expect(parseSuccessEnvelope(response, PaymentProvidersResponseSchema).data).toStrictEqual({ providers: [{ name: "FAKE", refunds: true }] });
	});

	it("asks for a payment, and returns the same one for the same Idempotency-Key", async () => {
		const key = `e2e-${randomUUID()}`;
		const first = await create(owner, KL, key);
		expect(first.statusCode, first.body).toBe(201);
		const payment = parseSuccessEnvelope(first, PaymentIntentResponseSchema).data;
		expect(payment).toMatchObject({ status: "PENDING", provider: "FAKE", amountMinor: 2_500, refundable: false });
		expect(payment.checkoutUrl).toContain("fake_payment=");

		const again = parseSuccessEnvelope(await create(owner, KL, key), PaymentIntentResponseSchema).data;
		expect(again.id).toBe(payment.id);
		const reused = await create(owner, KL, key, paymentRequest({ amountMinor: 9_900 }));
		expect(reused.statusCode).toBe(409);
	});

	it("refuses a request without an Idempotency-Key, or returning the payer to another site", async () => {
		expect((await create(owner, KL, null)).statusCode).toBe(400);
		const offsite = await create(owner, KL, `e2e-${randomUUID()}`, paymentRequest({ returnUrl: "https://evil.example.net/steal" }));
		expect(offsite.statusCode).toBe(400);
		expect(ErrorEnvelopeSchema.parse(offsite.json()).error.code).toBe("VALIDATION_ERROR");
	});

	it("marks a payment paid on a signed callback, once, refuses an unsigned one, and refunds it", async () => {
		const payment = parseSuccessEnvelope(await create(owner, KL, `e2e-${randomUUID()}`), PaymentIntentResponseSchema).data;
		const providerPaymentId = z.string().parse(payment.providerPaymentId);
		const paid = fakeCallback(providerPaymentId, payment.id, "PAID", 2_500);

		expect((await callback(paid.body, null)).statusCode).toBe(401);
		expect((await callback(paid.body, paid.signature)).statusCode).toBe(200);
		expect((await callback(paid.body, paid.signature)).statusCode).toBe(200);

		const read = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${KL}/payments/${payment.id}`, headers: merchantHeaders(owner) });
		expect(parseSuccessEnvelope(read, PaymentIntentResponseSchema).data).toMatchObject({ status: "PAID", refundable: true, checkoutUrl: null });

		const refund = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/tenants/${KL}/payments/${payment.id}/refund`,
			headers: mutationHeaders(merchantHeaders(owner)),
		});
		expect(parseSuccessEnvelope(refund, PaymentRefundResponseSchema).data).toMatchObject({ outcome: "refunded", payment: { status: "REFUNDED" } });
	});

	it("never marks a payment paid when the callback's amount differs", async () => {
		const payment = parseSuccessEnvelope(await create(owner, KL, `e2e-${randomUUID()}`), PaymentIntentResponseSchema).data;
		const tampered = fakeCallback(z.string().parse(payment.providerPaymentId), payment.id, "PAID", 1);
		expect((await callback(tampered.body, tampered.signature)).statusCode).toBe(200);
		const read = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${KL}/payments/${payment.id}`, headers: merchantHeaders(owner) });
		expect(parseSuccessEnvelope(read, PaymentIntentResponseSchema).data.status).toBe("PENDING");
	});

	it("lists a tenant's own payments, and never another tenant's", async () => {
		const payment = parseSuccessEnvelope(await create(owner, KL, `e2e-${randomUUID()}`), PaymentIntentResponseSchema).data;
		const list = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${KL}/payments`, headers: merchantHeaders(owner) });
		expect(parsePaginatedEnvelope(list, PaymentIntentResponseSchema).data.map((row) => row.id)).toContain(payment.id);

		const crossTenant = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${KL}/payments/${payment.id}`, headers: merchantHeaders(otherOwner) });
		expect([403, 404]).toContain(crossTenant.statusCode);
		const ownList = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${MLK}/payments`, headers: merchantHeaders(otherOwner) });
		expect(parsePaginatedEnvelope(ownList, PaymentIntentResponseSchema).data.map((row) => row.id)).not.toContain(payment.id);
	});
});
