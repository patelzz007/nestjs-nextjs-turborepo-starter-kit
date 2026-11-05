import { epochMs, WEBHOOK_ID_HEADER, WEBHOOK_SIGNATURE_HEADER, WebhookEventEnvelopeSchema, WebhookSaleCompletedDataSchema } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD } from "../../domain/aggregates/webhook-endpoint.aggregate";
import { WEBHOOK_DELIVERY_RETRY_POLICY } from "../../domain/policies/delivery-retry.policy";
import { webhookSignatureHeader } from "../../domain/policies/webhook-signature.policy";
import { WEBHOOKS_DELIVER_OPERATION, WEBHOOKS_RETENTION_OPERATION, WEBHOOKS_SWEEP_OPERATION } from "../ports/webhooks-outbound.tokens";
import { WEBHOOK_DELIVERY_LEASE_MS, WEBHOOK_EVENT_RETENTION_MS, WEBHOOK_FAN_OUT_GRACE_MS, WebhookDeliveryEngine } from "../services/webhook-delivery-engine";
import {
	AdjustableClock,
	FAILED_SEND,
	FakeWebhookSecrets,
	InMemoryWebhooksStore,
	InMemoryWebhooksUnitOfWork,
	NOW,
	OTHER_TENANT_ID,
	OWNER_ID,
	ScriptedWebhookSender,
	seedEndpoint,
	SequentialWebhookIds,
	TENANT_ID,
} from "./fakes/webhooks.fakes";

const ENDPOINT_A = "0193f2c4-0000-7000-8000-0000000e0001";
const ENDPOINT_B = "0193f2c4-0000-7000-8000-0000000e0002";
const EVENT_ID = "0193f2c4-0000-7000-8000-0000000f0001";
const SALE_DATA = WebhookSaleCompletedDataSchema.parse({
	saleId: "0193f2c4-0000-7000-8000-0000000c0001",
	locationId: null,
	terminalId: "TERM-1",
	billTotalMinor: 2500,
	currency: "MYR",
	claimIds: [],
});
/** Random 0.5: the retry jitter adds nothing. */
const NO_JITTER = (): number => 0.5;

describe("WebhookDeliveryEngine", () => {
	let store: InMemoryWebhooksStore;
	let uow: InMemoryWebhooksUnitOfWork;
	let secrets: FakeWebhookSecrets;
	let sender: ScriptedWebhookSender;
	let clock: AdjustableClock;
	let engine: WebhookDeliveryEngine;

	async function appendSale(eventId = EVENT_ID, tenantId = TENANT_ID): Promise<void> {
		await store.append({ id: eventId, tenantId, draft: { type: "sale.completed", data: SALE_DATA }, occurredAt: NOW });
	}

	beforeEach(() => {
		store = new InMemoryWebhooksStore();
		uow = new InMemoryWebhooksUnitOfWork(store);
		secrets = new FakeWebhookSecrets();
		sender = new ScriptedWebhookSender();
		clock = new AdjustableClock();
		engine = new WebhookDeliveryEngine({ uow, secrets, sender, ids: new SequentialWebhookIds(), clock, random: NO_JITTER });
	});

	describe("fanOut", () => {
		it("creates one delivery per active endpoint of the tenant subscribed to the type", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			seedEndpoint(store, secrets, ENDPOINT_B, { eventTypes: ["reward.published"] });
			seedEndpoint(store, secrets, "0193f2c4-0000-7000-8000-0000000e0003", { status: "DISABLED", disabledReason: "MANUAL" });
			seedEndpoint(store, secrets, "0193f2c4-0000-7000-8000-0000000e0004", { tenantId: OTHER_TENANT_ID });
			await appendSale();

			const ids = await engine.fanOut(EVENT_ID, TENANT_ID);

			expect(ids).toHaveLength(1);
			expect([...store.deliveryRows.values()].map((row) => row.endpointId)).toEqual([ENDPOINT_A]);
			expect(store.eventRows.get(EVENT_ID)?.fannedOutAt).toBe(NOW);
			expect(uow.committed).toEqual([{ operation: WEBHOOKS_SWEEP_OPERATION }]);
		});

		it("is idempotent: a second fan-out adds nothing and still answers the waiting deliveries", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await appendSale();
			const first = await engine.fanOut(EVENT_ID, TENANT_ID);
			const second = await engine.fanOut(EVENT_ID, TENANT_ID);

			expect(second).toEqual(first);
			expect(store.deliveryRows.size).toBe(1);
		});

		it("never fans a test event out (its one delivery is the member's)", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await store.append({ id: EVENT_ID, tenantId: TENANT_ID, draft: { type: "webhook.test", data: { endpointId: ENDPOINT_A, message: "hi" } }, occurredAt: NOW });

			expect(await engine.fanOut(EVENT_ID, TENANT_ID)).toEqual([]);
			expect(store.eventRows.get(EVENT_ID)?.fannedOutAt).toBe(NOW);
		});

		it("answers nothing for an event that is gone", async () => {
			expect(await engine.fanOut(EVENT_ID, TENANT_ID)).toEqual([]);
		});
	});

	describe("deliver", () => {
		async function queuedDelivery(): Promise<string> {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await appendSale();
			const [deliveryId] = await engine.fanOut(EVENT_ID, TENANT_ID);
			if (deliveryId === undefined) {
				throw new Error("no delivery queued");
			}
			return deliveryId;
		}

		it("sends the catalog envelope, signed with the endpoint's secret, and records the success", async () => {
			const deliveryId = await queuedDelivery();

			expect(await engine.deliver(deliveryId, TENANT_ID)).toBe("sent");

			const [request] = sender.sent;
			expect(request?.url).toBe("https://hooks.example.com/in");
			const body = WebhookEventEnvelopeSchema.parse(JSON.parse(request?.body ?? "{}"));
			expect(body).toMatchObject({ id: EVENT_ID, type: "sale.completed", tenantId: TENANT_ID, createdAt: NOW, data: SALE_DATA });
			const timestamp = Math.floor(NOW / 1000);
			expect(request?.headers[WEBHOOK_ID_HEADER.toLowerCase()]).toBe(deliveryId);
			expect(request?.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()]).toBe(webhookSignatureHeader(["whsec_secret1"], timestamp, request?.body ?? ""));
			expect(store.deliveries.delivery(deliveryId)).toMatchObject({ status: "SUCCEEDED", attempts: 1, deliveredAt: NOW, lastStatusCode: 200 });
			expect(store.endpointRows.get(ENDPOINT_A)).toMatchObject({ consecutiveFailures: 0, lastDeliveryAt: NOW });
			expect(uow.committed.map((entry) => entry.operation)).toContain(WEBHOOKS_DELIVER_OPERATION);
		});

		it("signs with the previous secret too while its grace lasts", async () => {
			const deliveryId = await queuedDelivery();
			const previous = secrets.create(ENDPOINT_A);
			const row = store.endpointRows.get(ENDPOINT_A);
			if (row !== undefined) {
				store.endpointRows.set(ENDPOINT_A, { ...row, previousSecretCiphertext: previous.sealed.ciphertext, previousSecretExpiresAt: epochMs(NOW + 1) });
			}

			await engine.deliver(deliveryId, TENANT_ID);

			const header = sender.sent.at(0)?.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] ?? "";
			expect(header.split(",").filter((part) => part.startsWith("v1="))).toHaveLength(2);
		});

		it("schedules a retry after a failure, with the policy's back-off", async () => {
			const deliveryId = await queuedDelivery();
			sender.answer = FAILED_SEND;

			await engine.deliver(deliveryId, TENANT_ID);

			expect(store.deliveries.delivery(deliveryId)).toMatchObject({
				status: "FAILED",
				attempts: 1,
				nextAttemptAt: NOW + WEBHOOK_DELIVERY_RETRY_POLICY.baseDelayMs,
				lastError: "HTTP 500",
			});
			expect(store.endpointRows.get(ENDPOINT_A)?.consecutiveFailures).toBe(0);
		});

		it("does not send a delivery that is not due, or that another worker holds", async () => {
			const deliveryId = await queuedDelivery();
			await store.deliveries.claim(deliveryId, NOW, epochMs(NOW + WEBHOOK_DELIVERY_LEASE_MS));

			expect(await engine.deliver(deliveryId, TENANT_ID)).toBe("skipped");
			expect(sender.sent).toHaveLength(0);
		});

		it("cancels a delivery whose endpoint was switched off meanwhile", async () => {
			const deliveryId = await queuedDelivery();
			const row = store.endpointRows.get(ENDPOINT_A);
			if (row !== undefined) {
				store.endpointRows.set(ENDPOINT_A, { ...row, status: "DISABLED", disabledReason: "MANUAL" });
			}

			expect(await engine.deliver(deliveryId, TENANT_ID)).toBe("cancelled");
			expect(store.deliveries.delivery(deliveryId)?.status).toBe("CANCELLED");
			expect(sender.sent).toHaveLength(0);
		});

		it("gives up after the last attempt and turns a failing endpoint off, telling its owners once", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A, { consecutiveFailures: WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD - 1 });
			await appendSale();
			const [deliveryId] = await engine.fanOut(EVENT_ID, TENANT_ID);
			const row = deliveryId === undefined ? undefined : store.deliveries.delivery(deliveryId);
			if (deliveryId === undefined || row === undefined) {
				throw new Error("no delivery queued");
			}
			store.deliveryRows.set(deliveryId, { ...row, status: "FAILED", attempts: WEBHOOK_DELIVERY_RETRY_POLICY.maxAttempts - 1 });
			sender.answer = FAILED_SEND;

			await engine.deliver(deliveryId, TENANT_ID);

			expect(store.deliveries.delivery(deliveryId)?.status).toBe("DEAD");
			expect(store.endpointRows.get(ENDPOINT_A)).toMatchObject({
				status: "DISABLED",
				disabledReason: "FAILING",
				consecutiveFailures: WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD,
			});
			expect(store.notifications).toEqual([
				expect.objectContaining({
					typeKey: "webhooks.endpoint-auto-disabled",
					recipient: { kind: "user", userId: OWNER_ID },
					tenantId: TENANT_ID,
					payload: {
						endpointId: ENDPOINT_A,
						endpointUrl: "https://hooks.example.com/in",
						tenantSlug: "sunrise",
						consecutiveFailures: WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD,
					},
				}),
			]);
		});

		it("resets the failure streak on a success", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A, { consecutiveFailures: 3 });
			await appendSale();
			const [deliveryId] = await engine.fanOut(EVENT_ID, TENANT_ID);

			await engine.deliver(deliveryId ?? "", TENANT_ID);

			expect(store.endpointRows.get(ENDPOINT_A)?.consecutiveFailures).toBe(0);
		});
	});

	describe("sweepOnce", () => {
		it("fans out events that missed their immediate fan-out and sends every due delivery", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await appendSale();
			clock.current = NOW + WEBHOOK_FAN_OUT_GRACE_MS + 1;

			expect(await engine.sweepOnce()).toEqual({ fannedOut: 1, attempted: 1 });
			expect(sender.sent).toHaveLength(1);
		});

		it("leaves a fresh event to its own after-commit fan-out", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await appendSale();

			expect(await engine.sweepOnce()).toEqual({ fannedOut: 0, attempted: 0 });
		});

		it("retries a failed delivery once it is due", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await appendSale();
			const [deliveryId] = await engine.fanOut(EVENT_ID, TENANT_ID);
			sender.answer = FAILED_SEND;
			await engine.deliver(deliveryId ?? "", TENANT_ID);
			sender.answer = { succeeded: true, statusCode: 204, error: null, durationMs: 5 };
			clock.current = NOW + WEBHOOK_DELIVERY_RETRY_POLICY.baseDelayMs;

			expect((await engine.sweepOnce()).attempted).toBe(1);
			expect(store.deliveries.delivery(deliveryId ?? "")).toMatchObject({ status: "SUCCEEDED", attempts: 2 });
		});
	});

	describe("purgeExpired", () => {
		it("deletes events past the retention window with their deliveries, and keeps newer ones", async () => {
			seedEndpoint(store, secrets, ENDPOINT_A);
			await appendSale();
			await engine.fanOut(EVENT_ID, TENANT_ID);
			await appendSale("0193f2c4-0000-7000-8000-0000000f0002");
			const fresh = store.eventRows.get("0193f2c4-0000-7000-8000-0000000f0002");
			if (fresh !== undefined) {
				store.eventRows.set(fresh.id, { ...fresh, createdAt: epochMs(NOW + WEBHOOK_EVENT_RETENTION_MS) });
			}
			clock.current = NOW + WEBHOOK_EVENT_RETENTION_MS + 1;

			expect(await engine.purgeExpired()).toBe(1);
			expect([...store.eventRows.keys()]).toEqual(["0193f2c4-0000-7000-8000-0000000f0002"]);
			expect(store.deliveryRows.size).toBe(0);
			expect(uow.committed.at(-1)).toEqual({ operation: WEBHOOKS_RETENTION_OPERATION });
		});
	});
});
