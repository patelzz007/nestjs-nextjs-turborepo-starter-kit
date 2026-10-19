import { describe, expect, it } from "vitest";

import { ActorContextSchema, systemActor, type ActorContext } from "../../../../platform/application/actor-context";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { EmailDeliveryStatusChanged } from "../../domain/events/email-log-updated.event";
import { ApplyEmailDeliveryEventCommand, type DeliveryWebhookEvent } from "../commands/apply-email-delivery-event/apply-email-delivery-event.command";
import { ApplyEmailDeliveryEventHandler } from "../commands/apply-email-delivery-event/apply-email-delivery-event.handler";
import { SendTestEmailCommand } from "../commands/send-test-email/send-test-email.command";
import { SendTestEmailHandler } from "../commands/send-test-email/send-test-email.handler";
import { EMAIL_LOG_ID, InMemoryEmailLogs, NOW, RecordingEmailRequests, notificationsScope } from "./fakes/notifications.fakes";

const WEBHOOK_ACTOR = systemActor("email.log.write", "consumer", null, "Apply a verified delivery webhook event", null);
const ADMIN: ActorContext = ActorContextSchema.parse({
	kind: "user",
	userId: "11111111-1111-4111-8111-111111111111",
	sessionId: "session-1",
	organizationId: null,
	isSuperAdmin: true,
	accessScope: "superadmin",
	impersonatorUserId: null,
	request: { requestId: "request-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
});

function webhook(overrides: Partial<DeliveryWebhookEvent> = {}): DeliveryWebhookEvent {
	return {
		webhookId: "msg_1",
		eventType: "email.delivered",
		resendId: "resend-1",
		taggedEmailLogId: EMAIL_LOG_ID,
		status: "delivered",
		detail: undefined,
		occurredAt: NOW,
		...overrides,
	};
}

describe("ApplyEmailDeliveryEventHandler", () => {
	function setup(status = "sent"): {
		handler: ApplyEmailDeliveryEventHandler;
		logs: InMemoryEmailLogs;
		scope: ReturnType<typeof notificationsScope>;
		uow: InMemoryUnitOfWork<ReturnType<typeof notificationsScope>>;
	} {
		const logs = new InMemoryEmailLogs();
		logs.seed(EMAIL_LOG_ID, status);
		const scope = notificationsScope(logs);
		const uow = new InMemoryUnitOfWork(scope);
		return { handler: new ApplyEmailDeliveryEventHandler(uow, new FixedClock(NOW)), logs, scope, uow };
	}

	it("applies a forward transition with the forward table, as email.log.write, and signals the admin stream", async () => {
		const { handler, logs, scope, uow } = setup();

		await expect(handler.execute(new ApplyEmailDeliveryEventCommand(WEBHOOK_ACTOR, webhook()))).resolves.toEqual({
			kind: "recorded",
			outcome: "applied",
			emailLogId: EMAIL_LOG_ID,
		});
		expect(logs.deliveryEvents.at(0)?.allowedFrom).toEqual(["pending", "sent", "delivered", "bounced"]);
		expect(logs.status(EMAIL_LOG_ID)).toBe("delivered");
		expect(scope.events.take().at(0)).toBeInstanceOf(EmailDeliveryStatusChanged);
		expect(uow.committed).toEqual([{ actor: WEBHOOK_ACTOR, operation: "email.log.write" }]);
	});

	it("records a regression as stale and a redelivered webhook as duplicate, signalling nothing", async () => {
		const { handler, scope } = setup("delivered");

		await expect(handler.execute(new ApplyEmailDeliveryEventCommand(WEBHOOK_ACTOR, webhook({ eventType: "email.sent", status: "sent" })))).resolves.toMatchObject({
			outcome: "stale",
		});
		await expect(handler.execute(new ApplyEmailDeliveryEventCommand(WEBHOOK_ACTOR, webhook({ eventType: "email.sent", status: "sent" })))).resolves.toEqual({
			kind: "duplicate",
		});
		expect(scope.events.take()).toEqual([]);
	});

	it("passes no allowed statuses for an event that maps to none (tracking events are only recorded)", async () => {
		const { handler, logs } = setup();

		await expect(handler.execute(new ApplyEmailDeliveryEventCommand(WEBHOOK_ACTOR, webhook({ eventType: "email.opened", status: undefined })))).resolves.toMatchObject({
			outcome: "ignored",
		});
		expect(logs.deliveryEvents.at(0)?.allowedFrom).toEqual([]);
	});
});

describe("SendTestEmailHandler", () => {
	it("requests the template's sample in the admin's own unit of work, audited with the admin", async () => {
		const requests = new RecordingEmailRequests();
		const uow = new InMemoryUnitOfWork(notificationsScope(new InMemoryEmailLogs(), requests));

		await expect(new SendTestEmailHandler(uow).execute(new SendTestEmailCommand(ADMIN, { templateKey: "admin-alert" }))).resolves.toMatchObject({ ok: true, mode: "queued" });
		expect(requests.requests).toEqual([
			{ templateKey: "admin-alert", options: { audit: { trigger: "admin-test-send", actorUserId: ADMIN.kind === "user" ? ADMIN.userId : "" } } },
		]);
		expect(uow.committed).toEqual([{ actor: ADMIN, operation: null }]);
	});

	it("refuses a caller that is not a signed-in user and requests nothing", async () => {
		const requests = new RecordingEmailRequests();
		const uow = new InMemoryUnitOfWork(notificationsScope(new InMemoryEmailLogs(), requests));

		await expect(new SendTestEmailHandler(uow).execute(new SendTestEmailCommand(WEBHOOK_ACTOR, { templateKey: "admin-alert" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(requests.requests).toEqual([]);
	});
});
