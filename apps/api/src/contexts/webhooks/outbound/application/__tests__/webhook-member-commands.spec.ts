import {
	DEFAULT_WEBHOOK_SECRET_GRACE_HOURS,
	MAX_WEBHOOK_ENDPOINTS_PER_TENANT,
	MERCHANT_CAPABILITY,
	WebhookSubscribableEventTypeSchema,
	type WebhookDeliverySummary,
} from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../../platform/application/errors/app-error";
import {
	WebhookDeliveryInProgressError,
	WebhookEndpointLimitReachedError,
	WebhookEndpointNotActiveError,
	WebhookEndpointNotFoundError,
	WebhookEndpointUrlRefusedError,
	WebhooksNotConfiguredError,
} from "../../domain/errors/webhooks.errors";
import { CreateWebhookEndpointCommand } from "../commands/create-webhook-endpoint/create-webhook-endpoint.command";
import { CreateWebhookEndpointHandler } from "../commands/create-webhook-endpoint/create-webhook-endpoint.handler";
import { DeleteWebhookEndpointCommand } from "../commands/delete-webhook-endpoint/delete-webhook-endpoint.command";
import { DeleteWebhookEndpointHandler } from "../commands/delete-webhook-endpoint/delete-webhook-endpoint.handler";
import { DisableWebhookEndpointCommand } from "../commands/disable-webhook-endpoint/disable-webhook-endpoint.command";
import { DisableWebhookEndpointHandler } from "../commands/disable-webhook-endpoint/disable-webhook-endpoint.handler";
import { EnableWebhookEndpointCommand } from "../commands/enable-webhook-endpoint/enable-webhook-endpoint.command";
import { EnableWebhookEndpointHandler } from "../commands/enable-webhook-endpoint/enable-webhook-endpoint.handler";
import { RedeliverWebhookCommand } from "../commands/redeliver-webhook/redeliver-webhook.command";
import { RedeliverWebhookHandler } from "../commands/redeliver-webhook/redeliver-webhook.handler";
import { RotateWebhookSecretCommand } from "../commands/rotate-webhook-secret/rotate-webhook-secret.command";
import { RotateWebhookSecretHandler } from "../commands/rotate-webhook-secret/rotate-webhook-secret.handler";
import { SendWebhookTestCommand } from "../commands/send-webhook-test/send-webhook-test.command";
import { SendWebhookTestHandler } from "../commands/send-webhook-test/send-webhook-test.handler";
import { UpdateWebhookEndpointCommand } from "../commands/update-webhook-endpoint/update-webhook-endpoint.command";
import { UpdateWebhookEndpointHandler } from "../commands/update-webhook-endpoint/update-webhook-endpoint.handler";
import type { WebhookUrlCheck, WebhookUrlPolicyPort } from "../ports/webhook-url-policy.port";
import type { WebhooksReadPort } from "../ports/webhooks-read.port";
import {
	AdjustableClock,
	apiKeyActor,
	FakeMerchantAccess,
	FakeWebhookSecrets,
	InMemoryWebhooksStore,
	InMemoryWebhooksUnitOfWork,
	member,
	NOW,
	OTHER_TENANT_ID,
	seedEndpoint,
	SequentialWebhookIds,
	TENANT_ID,
} from "./fakes/webhooks.fakes";

const ENDPOINT_ID = "0193f2c4-0000-7000-8000-0000000e0001";
const MS_PER_HOUR = 3_600_000;

class ScriptedUrlPolicy implements WebhookUrlPolicyPort {
	public answer: WebhookUrlCheck = { ok: true };

	public check(): WebhookUrlCheck {
		return this.answer;
	}
}

/** Reads a delivery straight from the store, as the console would after the command. */
class StoreReads implements Pick<WebhooksReadPort, "findDelivery"> {
	public constructor(private readonly store: InMemoryWebhooksStore) {}

	public findDelivery(_actor: ActorContext, tenantId: string, deliveryId: string): Promise<WebhookDeliverySummary | null> {
		const row = this.store.deliveries.delivery(deliveryId);
		if (row === undefined || row.tenantId !== tenantId) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			id: row.id,
			endpointId: row.endpointId,
			endpointUrl: "https://hooks.example.com/in",
			eventId: row.eventId,
			eventType: "webhook.test",
			status: row.status,
			attempts: row.attempts,
			nextAttemptAt: row.nextAttemptAt,
			lastAttemptAt: null,
			lastStatusCode: row.lastStatusCode,
			lastError: row.lastError,
			lastDurationMs: null,
			deliveredAt: row.deliveredAt,
			createdAt: NOW,
		});
	}
}

describe("webhook member commands", () => {
	let store: InMemoryWebhooksStore;
	let uow: InMemoryWebhooksUnitOfWork;
	let access: FakeMerchantAccess;
	let secrets: FakeWebhookSecrets;
	let urls: ScriptedUrlPolicy;
	let ids: SequentialWebhookIds;
	let clock: AdjustableClock;

	beforeEach(() => {
		store = new InMemoryWebhooksStore();
		uow = new InMemoryWebhooksUnitOfWork(store);
		access = new FakeMerchantAccess();
		secrets = new FakeWebhookSecrets();
		urls = new ScriptedUrlPolicy();
		ids = new SequentialWebhookIds();
		clock = new AdjustableClock();
	});

	function createHandler(): CreateWebhookEndpointHandler {
		return new CreateWebhookEndpointHandler(uow, access, secrets, urls, ids, clock);
	}

	const CREATE_INPUT = { tenantId: TENANT_ID, url: "https://crm.example.com/in", description: "CRM", eventTypes: [WebhookSubscribableEventTypeSchema.enum["sale.completed"]] };

	describe("create", () => {
		it("checks the member's capability, seals a fresh secret and answers it once", async () => {
			const result = await createHandler().execute(new CreateWebhookEndpointCommand(member(), CREATE_INPUT));

			expect(access.checks).toEqual([{ tenantId: TENANT_ID, capability: MERCHANT_CAPABILITY.manageWebhooks }]);
			expect(result.secret).toBe("whsec_secret1");
			expect(result.endpoint).toMatchObject({ url: CREATE_INPUT.url, status: "ACTIVE", secretHint: "ret1", eventTypes: ["sale.completed"] });
			expect(JSON.stringify(result.endpoint)).not.toContain("whsec_secret1");
			expect(store.endpointRows.get(result.endpoint.id)?.secret.ciphertext).toBe(`sealed:${result.endpoint.id}:whsec_secret1`);
			expect(store.locks).toBe(1);
		});

		it("refuses API keys: endpoints are managed by people", async () => {
			await expect(createHandler().execute(new CreateWebhookEndpointCommand(apiKeyActor(), CREATE_INPUT))).rejects.toBeInstanceOf(AuthenticationError);
		});

		it("refuses when the deployment has no key ring", async () => {
			secrets.configured = false;
			await expect(createHandler().execute(new CreateWebhookEndpointCommand(member(), CREATE_INPUT))).rejects.toBeInstanceOf(WebhooksNotConfiguredError);
		});

		it("refuses an address the outbound policy refuses, saying why", async () => {
			urls.answer = { ok: false, reason: "address_not_allowed", message: "That address is on a private network." };
			const failure = createHandler().execute(new CreateWebhookEndpointCommand(member(), CREATE_INPUT));
			await expect(failure).rejects.toBeInstanceOf(WebhookEndpointUrlRefusedError);
			await expect(failure).rejects.toThrow("That address is on a private network.");
		});

		it("holds the per-tenant limit", async () => {
			for (let index = 0; index < MAX_WEBHOOK_ENDPOINTS_PER_TENANT; index += 1) {
				seedEndpoint(store, secrets, `0193f2c4-0000-7000-8000-${String(index).padStart(12, "0")}`);
			}
			await expect(createHandler().execute(new CreateWebhookEndpointCommand(member(), CREATE_INPUT))).rejects.toBeInstanceOf(WebhookEndpointLimitReachedError);
		});
	});

	describe("change", () => {
		beforeEach(() => {
			seedEndpoint(store, secrets, ENDPOINT_ID);
		});

		it("updates the details, checking a new address", async () => {
			const handler = new UpdateWebhookEndpointHandler(uow, access, clock, urls);
			const result = await handler.execute(new UpdateWebhookEndpointCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID, url: "https://new.example.com/in" }));

			expect(result.url).toBe("https://new.example.com/in");
			expect(result.version).toBe(1);
			urls.answer = { ok: false, reason: "scheme_not_allowed", message: "Use https." };
			await expect(
				handler.execute(new UpdateWebhookEndpointCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID, url: "http://x.example" })),
			).rejects.toBeInstanceOf(WebhookEndpointUrlRefusedError);
		});

		it("answers another tenant's endpoint as not found", async () => {
			const handler = new DisableWebhookEndpointHandler(uow, access, clock);
			await expect(handler.execute(new DisableWebhookEndpointCommand(member(), { tenantId: OTHER_TENANT_ID, endpointId: ENDPOINT_ID }))).rejects.toBeInstanceOf(
				WebhookEndpointNotFoundError,
			);
		});

		it("switches it off and on again, forgetting its failures", async () => {
			const row = store.endpointRows.get(ENDPOINT_ID);
			if (row !== undefined) {
				store.endpointRows.set(ENDPOINT_ID, { ...row, consecutiveFailures: 4 });
			}
			const off = await new DisableWebhookEndpointHandler(uow, access, clock).execute(
				new DisableWebhookEndpointCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID }),
			);
			expect(off).toMatchObject({ status: "DISABLED", disabledReason: "MANUAL" });

			const on = await new EnableWebhookEndpointHandler(uow, access, clock).execute(
				new EnableWebhookEndpointCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID }),
			);
			expect(on).toMatchObject({ status: "ACTIVE", disabledReason: null, consecutiveFailures: 0 });
		});

		it("rotates the secret, keeping the previous one signing for the grace asked for", async () => {
			const handler = new RotateWebhookSecretHandler(uow, access, clock, secrets);
			const kept = await handler.execute(
				new RotateWebhookSecretCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID, keepPreviousForHours: DEFAULT_WEBHOOK_SECRET_GRACE_HOURS }),
			);

			expect(kept.secret).toBe("whsec_secret2");
			expect(kept.endpoint.previousSecretExpiresAt).toBe(NOW + DEFAULT_WEBHOOK_SECRET_GRACE_HOURS * MS_PER_HOUR);
			expect(store.endpointRows.get(ENDPOINT_ID)?.previousSecretCiphertext).toBe(`sealed:${ENDPOINT_ID}:whsec_secret1`);

			const leaked = await handler.execute(new RotateWebhookSecretCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID, keepPreviousForHours: 0 }));
			expect(leaked.endpoint.previousSecretExpiresAt).toBeNull();
			expect(store.endpointRows.get(ENDPOINT_ID)?.previousSecretCiphertext).toBeNull();
		});

		it("removes it softly", async () => {
			const result = await new DeleteWebhookEndpointHandler(uow, access, clock).execute(
				new DeleteWebhookEndpointCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID }),
			);

			expect(result).toEqual({ success: true });
			expect(store.endpointRows.get(ENDPOINT_ID)).toMatchObject({ isDeleted: true, deletedAt: NOW });
		});
	});

	describe("test event", () => {
		it("queues one test event and one delivery for this endpoint only", async () => {
			seedEndpoint(store, secrets, ENDPOINT_ID);
			seedEndpoint(store, secrets, "0193f2c4-0000-7000-8000-0000000e0002");
			const handler = new SendWebhookTestHandler(uow, access, ids, new StoreReads(store), clock);

			const delivery = await handler.execute(new SendWebhookTestCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID }));

			expect(delivery).toMatchObject({ endpointId: ENDPOINT_ID, status: "PENDING" });
			expect(store.deliveryRows.size).toBe(1);
			expect([...store.eventRows.values()].map((row) => row.eventType)).toEqual(["webhook.test"]);
			expect(store.eventNames()).toEqual(["webhooks.WebhookDeliveryQueued"]);
		});

		it("refuses an endpoint that is switched off", async () => {
			seedEndpoint(store, secrets, ENDPOINT_ID, { status: "DISABLED", disabledReason: "MANUAL" });
			const handler = new SendWebhookTestHandler(uow, access, ids, new StoreReads(store), clock);

			await expect(handler.execute(new SendWebhookTestCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID }))).rejects.toBeInstanceOf(
				WebhookEndpointNotActiveError,
			);
			expect(store.eventRows.size).toBe(0);
		});
	});

	describe("redeliver", () => {
		async function settledDelivery(status: "DEAD" | "FAILED"): Promise<string> {
			seedEndpoint(store, secrets, ENDPOINT_ID);
			const handler = new SendWebhookTestHandler(uow, access, ids, new StoreReads(store), clock);
			const delivery = await handler.execute(new SendWebhookTestCommand(member(), { tenantId: TENANT_ID, endpointId: ENDPOINT_ID }));
			const row = store.deliveries.delivery(delivery.id);
			if (row !== undefined) {
				store.deliveryRows.set(delivery.id, { ...row, status, attempts: 10, nextAttemptAt: null });
			}
			store.eventNames();
			return delivery.id;
		}

		it("queues a settled delivery again from attempt one", async () => {
			const deliveryId = await settledDelivery("DEAD");
			const result = await new RedeliverWebhookHandler(uow, access, new StoreReads(store), clock).execute(
				new RedeliverWebhookCommand(member(), { tenantId: TENANT_ID, deliveryId }),
			);

			expect(result).toMatchObject({ id: deliveryId, status: "PENDING", attempts: 0 });
			expect(store.eventNames()).toEqual(["webhooks.WebhookDeliveryQueued"]);
		});

		it("refuses one that is still being retried", async () => {
			const deliveryId = await settledDelivery("FAILED");
			await expect(
				new RedeliverWebhookHandler(uow, access, new StoreReads(store), clock).execute(new RedeliverWebhookCommand(member(), { tenantId: TENANT_ID, deliveryId })),
			).rejects.toBeInstanceOf(WebhookDeliveryInProgressError);
		});
	});
});
