import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	PaymentIntentResponseSchema,
	WEBHOOK_ID_HEADER,
	WEBHOOK_SIGNATURE_HEADER,
	WEBHOOK_TIMESTAMP_HEADER,
	WebhookDeliverySummarySchema,
	WebhookEndpointSummarySchema,
	WebhookEndpointWithSecretSchema,
	WebhookEventEnvelopeSchema,
	type WebhookEventEnvelope,
} from "@workspace/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS } from "../prisma/seed/tenant-seed-ids";
import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, mutationHeaders, parsePaginatedEnvelope, parseSuccessEnvelope, type InjectResponse, type LoginResult, uniqueClientIp } from "./e2e-helpers";
import { TEST_E2E_PAYMENTS } from "./support/test-api-env";

const KL = TENANT_SEED_SLUGS.kl;
const FAKE_SECRET = z.string().parse(TEST_E2E_PAYMENTS.PAYMENTS_FAKE_SECRET);
/** How long a test waits for the receiver to be called (deliveries go out right after the commit). */
const RECEIVE_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 50;
const MS_PER_SECOND = 1_000;

/** One request the local receiver got. */
interface Received {
	readonly headers: IncomingMessage["headers"];
	readonly body: string;
}

/** A local HTTP receiver, as an integrator would run one (loopback endpoints are allowed under tests only). */
class TestReceiver {
	public readonly requests: Received[] = [];
	public status = 200;
	private readonly server: Server = createServer((request: IncomingMessage, response: ServerResponse): void => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer): void => {
			chunks.push(chunk);
		});
		request.on("end", (): void => {
			this.requests.push({ headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
			response.statusCode = this.status;
			response.end();
		});
	});

	public async start(): Promise<string> {
		await new Promise<void>((resolve): void => {
			this.server.listen(0, "127.0.0.1", resolve);
		});
		const AddressSchema = z.object({ port: z.number().int().positive() });
		const { port } = AddressSchema.parse(this.server.address());
		return `http://localhost:${String(port)}/hooks`;
	}

	public stop(): Promise<void> {
		return new Promise<void>((resolve): void => {
			this.server.close((): void => {
				resolve();
			});
		});
	}

	/** Waits for a request matching `match`, and answers it. */
	public async next(match: (event: WebhookEventEnvelope) => boolean): Promise<{ readonly received: Received; readonly event: WebhookEventEnvelope }> {
		const deadline = Date.now() + RECEIVE_TIMEOUT_MS;
		while (Date.now() < deadline) {
			for (const received of this.requests) {
				const event = WebhookEventEnvelopeSchema.parse(JSON.parse(received.body));
				if (match(event)) {
					return { received, event };
				}
			}
			await new Promise((resolve): void => {
				setTimeout(resolve, POLL_INTERVAL_MS);
			});
		}
		throw new Error("The receiver was not called in time");
	}
}

/** The receiver's check, exactly as the console's guide shows it: HMAC-SHA256 of "<t>.<raw body>". */
function signaturesOf(received: Received): { readonly timestamp: string; readonly signatures: readonly string[] } {
	const header = z.string().parse(received.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()]);
	const parts = header.split(",");
	const timestamp = (parts.find((part) => part.startsWith("t=")) ?? "").slice(2);
	return { timestamp, signatures: parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3)) };
}

function expectedSignature(secret: string, timestamp: string, body: string): string {
	return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Outgoing webhooks over HTTP (ADR 082), against a real local receiver: an owner registers an endpoint (its
 * secret is answered once), sends it a test event signed with that secret, a payment paid through the fake
 * gateway reaches a subscribed endpoint as `payment.succeeded`, a rotation signs with both secrets, a disabled
 * endpoint refuses a test, a cashier and another tenant cannot reach any of it, and removing it keeps the log.
 */
describe("Outgoing webhooks (e2e)", () => {
	let app: NestFastifyApplication;
	let owner: LoginResult;
	let cashier: LoginResult;
	let otherOwner: LoginResult;
	let receiver: TestReceiver;
	let receiverUrl: string;
	const created: string[] = [];

	function merchantHeaders(user: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${user.accessToken}; merchantRefreshToken=${user.refreshToken}`, "x-client-type": "merchant", "x-forwarded-for": uniqueClientIp() };
	}

	function call(user: LoginResult, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, payload?: object, slug: string = KL): Promise<InjectResponse> {
		const headers = method === "GET" ? merchantHeaders(user) : mutationHeaders(merchantHeaders(user));
		return app.inject({ method, url: `${API_VERSION_PREFIX}/tenants/${slug}/webhooks${path}`, headers, ...(payload === undefined ? {} : { payload }) });
	}

	async function register(eventTypes: readonly string[]): Promise<{ readonly id: string; readonly secret: string }> {
		const response = await call(owner, "POST", "/endpoints", { url: receiverUrl, description: `e2e ${randomUUID()}`, eventTypes });
		expect(response.statusCode).toBe(201);
		const { endpoint, secret } = parseSuccessEnvelope(response, WebhookEndpointWithSecretSchema).data;
		created.push(endpoint.id);
		return { id: endpoint.id, secret };
	}

	beforeAll(async () => {
		receiver = new TestReceiver();
		receiverUrl = await receiver.start();
		app = await createE2eApp();
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
		otherOwner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
	});

	afterEach(() => {
		receiver.status = 200;
	});

	afterAll(async () => {
		// Remove what this run registered (soft delete), so the tenant's endpoint limit holds across runs.
		for (const id of created) {
			await call(owner, "DELETE", `/endpoints/${id}`);
		}
		await app.close();
		await receiver.stop();
	});

	it("registers an endpoint, answers its secret once, and never shows it again", async () => {
		const { id, secret } = await register(["sale.completed"]);

		expect(secret.startsWith("whsec_")).toBe(true);
		const read = parseSuccessEnvelope(await call(owner, "GET", `/endpoints/${id}`), WebhookEndpointSummarySchema).data;
		expect(read).toMatchObject({ status: "ACTIVE", eventTypes: ["sale.completed"], secretHint: secret.slice(-4) });
		expect(JSON.stringify(read)).not.toContain(secret);
	});

	it("sends a test event signed with the endpoint's secret, and logs it as delivered", async () => {
		const { id, secret } = await register(["claim.redeemed"]);

		const queued = await call(owner, "POST", `/endpoints/${id}/test`);
		expect(queued.statusCode).toBe(202);
		const delivery = parseSuccessEnvelope(queued, WebhookDeliverySummarySchema).data;

		const { received, event } = await receiver.next((candidate) => candidate.type === "webhook.test" && candidate.data.endpointId === id);
		const { timestamp, signatures } = signaturesOf(received);
		expect(signatures).toStrictEqual([expectedSignature(secret, timestamp, received.body)]);
		expect(received.headers[WEBHOOK_ID_HEADER.toLowerCase()]).toBe(delivery.id);
		expect(received.headers[WEBHOOK_TIMESTAMP_HEADER.toLowerCase()]).toBe(timestamp);
		expect(Math.abs(Date.now() / MS_PER_SECOND - Number(timestamp))).toBeLessThan(RECEIVE_TIMEOUT_MS / MS_PER_SECOND);
		expect(event.tenantId).toBe(TENANT_SEED_IDS.klTenant);

		await expect
			.poll(async () => parsePaginatedEnvelope(await call(owner, "GET", `/deliveries?filter[endpointId][eq]=${id}`), WebhookDeliverySummarySchema).data.at(0)?.status, {
				timeout: RECEIVE_TIMEOUT_MS,
			})
			.toBe("SUCCEEDED");
	});

	it("tells a subscribed endpoint the moment a payment is paid", async () => {
		await register(["payment.succeeded"]);
		const paymentResponse = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/tenants/${KL}/payments`,
			headers: { ...mutationHeaders(merchantHeaders(owner)), "idempotency-key": `e2e-${randomUUID()}` },
			payload: {
				provider: "FAKE",
				amountMinor: 3_300,
				description: "Webhook e2e",
				payerName: "E2E Payer",
				payerEmail: "payer@example.com",
				returnUrl: "http://localhost:3003/payments/return",
			},
		});
		const payment = parseSuccessEnvelope(paymentResponse, PaymentIntentResponseSchema).data;
		const body = JSON.stringify({ id: payment.providerPaymentId, reference: payment.id, status: "PAID", amount: 3_300 });
		const callback = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/payments/callbacks/fake`,
			headers: { "content-type": "application/json", "x-forwarded-for": uniqueClientIp(), "x-fake-signature": createHmac("sha256", FAKE_SECRET).update(body).digest("hex") },
			payload: body,
		});
		expect(callback.statusCode).toBeLessThan(300);

		const { event } = await receiver.next((candidate) => candidate.type === "payment.succeeded" && candidate.data.paymentId === payment.id);
		expect(event.data).toMatchObject({ amountMinor: 3_300, currency: "MYR", provider: "FAKE" });
		expect(JSON.stringify(event)).not.toContain("payer@example.com");
	});

	it("signs with both secrets during a rotation's grace", async () => {
		const { id, secret: previous } = await register(["sale.completed"]);
		const rotated = parseSuccessEnvelope(await call(owner, "POST", `/endpoints/${id}/rotate-secret`, { keepPreviousForHours: 1 }), WebhookEndpointWithSecretSchema).data;
		expect(rotated.secret).not.toBe(previous);

		await call(owner, "POST", `/endpoints/${id}/test`);
		const { received } = await receiver.next((candidate) => candidate.type === "webhook.test" && candidate.data.endpointId === id);
		const { timestamp, signatures } = signaturesOf(received);
		expect(signatures).toStrictEqual([expectedSignature(rotated.secret, timestamp, received.body), expectedSignature(previous, timestamp, received.body)]);
	});

	it("refuses a test to a switched-off endpoint, and switches it on again", async () => {
		const { id } = await register(["sale.completed"]);
		const off = parseSuccessEnvelope(await call(owner, "POST", `/endpoints/${id}/disable`), WebhookEndpointSummarySchema).data;
		expect(off).toMatchObject({ status: "DISABLED", disabledReason: "MANUAL" });

		expect((await call(owner, "POST", `/endpoints/${id}/test`)).statusCode).toBe(409);
		const on = parseSuccessEnvelope(await call(owner, "POST", `/endpoints/${id}/enable`), WebhookEndpointSummarySchema).data;
		expect(on.status).toBe("ACTIVE");
	});

	it("refuses an address on a private network", async () => {
		const response = await call(owner, "POST", "/endpoints", { url: "https://10.1.2.3/hooks", eventTypes: ["sale.completed"] });
		expect(response.statusCode).toBe(400);
	});

	it("keeps a cashier and another tenant's owner out", async () => {
		const { id } = await register(["sale.completed"]);

		expect((await call(cashier, "GET", "/endpoints")).statusCode).toBe(403);
		expect((await call(otherOwner, "GET", `/endpoints/${id}`, undefined, TENANT_SEED_SLUGS.mlk)).statusCode).toBe(404);
		// Not a member of this tenant: answered as not found, so nobody can probe which businesses exist.
		expect((await call(otherOwner, "GET", `/endpoints/${id}`)).statusCode).toBe(404);
	});

	it("removes an endpoint and keeps its deliveries in the log", async () => {
		const { id } = await register(["sale.completed"]);
		await call(owner, "POST", `/endpoints/${id}/test`);
		await receiver.next((candidate) => candidate.type === "webhook.test" && candidate.data.endpointId === id);

		expect((await call(owner, "DELETE", `/endpoints/${id}`)).statusCode).toBe(200);
		expect((await call(owner, "GET", `/endpoints/${id}`)).statusCode).toBe(404);
		const log = parsePaginatedEnvelope(await call(owner, "GET", `/deliveries?filter[endpointId][eq]=${id}`), WebhookDeliverySummarySchema).data;
		expect(log.length).toBeGreaterThan(0);
	});
});
