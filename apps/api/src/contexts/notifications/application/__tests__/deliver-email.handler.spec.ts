import { describe, expect, it } from "vitest";
import type { AdminAlertEmailProps } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { EmailAttemptFinalized } from "../../domain/events/email-log-updated.event";
import { AdminAlertEmailTemplate } from "../../domain/templates/admin-alert-email.template";
import { serializeEmailTemplateProps } from "../../domain/templates/email-template-props";
import { DeliverEmailCommand, type DeliverEmailInput } from "../commands/deliver-email/deliver-email.command";
import {
	EmailDeliveryAbandonedError,
	EmailDeliveryRetryRequestedError,
	EmailLogMissingError,
	EmailSentButNotRecordedError,
} from "../commands/deliver-email/deliver-email.errors";
import { DeliverEmailHandler } from "../commands/deliver-email/deliver-email.handler";
import type { NotificationsScope } from "../notifications-scope";
import { EMAIL_LOG_ID, InMemoryEmailLogs, NOW, ScriptedDelivery, failure, notificationsScope } from "./fakes/notifications.fakes";

const ACTOR = systemActor("queue.email.send", "job", null, "Deliver one queued email", null);

const ALERT_PROPS: AdminAlertEmailProps = { to: AdminAlertEmailTemplate.sampleProps.to, title: "Alert", message: "Body" };

function input(overrides: Partial<DeliverEmailInput> = {}): DeliverEmailInput {
	return { emailLogId: EMAIL_LOG_ID, templateKey: "admin-alert", props: serializeEmailTemplateProps(ALERT_PROPS), attemptNumber: 1, maxAttempts: 3, ...overrides };
}

function setup(
	status = "pending",
	delivery = new ScriptedDelivery(),
): { handler: DeliverEmailHandler; logs: InMemoryEmailLogs; scope: NotificationsScope; uow: InMemoryUnitOfWork<NotificationsScope>; delivery: ScriptedDelivery } {
	const logs = new InMemoryEmailLogs();
	logs.seed(EMAIL_LOG_ID, status);
	const scope = notificationsScope(logs);
	const uow = new InMemoryUnitOfWork(scope);
	return { handler: new DeliverEmailHandler(uow, delivery, new FixedClock(NOW)), logs, scope, uow, delivery };
}

describe("DeliverEmailHandler", () => {
	it("makes ONE provider call idempotent by the log id, finalizes the row sent and emits one outcome event", async () => {
		const { handler, logs, scope, delivery } = setup();

		await expect(handler.execute(new DeliverEmailCommand(ACTOR, input()))).resolves.toEqual({ outcome: "sent", providerMessageId: "msg-1" });
		expect(delivery.calls).toEqual([{ emailLogId: EMAIL_LOG_ID, templateKey: "admin-alert" }]);
		expect(logs.status(EMAIL_LOG_ID)).toBe("sent");
		const events = scope.events.take();
		expect(events).toHaveLength(1);
		expect(events.at(0)).toBeInstanceOf(EmailAttemptFinalized);
	});

	it.each(["sent", "delivered", "failed", "bounced"])("skips a redelivered job whose row is already %s — no second provider call", async (status: string) => {
		const { handler, delivery, scope } = setup(status);

		await expect(handler.execute(new DeliverEmailCommand(ACTOR, input()))).resolves.toEqual({ outcome: "skipped" });
		expect(delivery.calls).toEqual([]);
		expect(scope.events.take()).toEqual([]);
	});

	it("refuses a job whose row does not exist (retrying cannot help)", async () => {
		const { handler } = setup();

		await expect(handler.execute(new DeliverEmailCommand(ACTOR, input({ emailLogId: "00000000-0000-4000-8000-000000000000" })))).rejects.toBeInstanceOf(EmailLogMissingError);
	});

	it("asks for a retry on a retryable failure before the last attempt and leaves the row pending", async () => {
		const { handler, logs } = setup("pending", new ScriptedDelivery([failure(true, "timeout")]));

		await expect(handler.execute(new DeliverEmailCommand(ACTOR, input()))).rejects.toBeInstanceOf(EmailDeliveryRetryRequestedError);
		expect(logs.status(EMAIL_LOG_ID)).toBe("pending");
	});

	it("abandons and finalizes failed on a non-retryable failure, and on the last attempt", async () => {
		const rejected = setup("pending", new ScriptedDelivery([failure(false, "invalid recipient")]));
		await expect(rejected.handler.execute(new DeliverEmailCommand(ACTOR, input()))).rejects.toBeInstanceOf(EmailDeliveryAbandonedError);
		expect(rejected.logs.status(EMAIL_LOG_ID)).toBe("failed");

		const exhausted = setup("pending", new ScriptedDelivery([failure(true, "timeout")]));
		await expect(exhausted.handler.execute(new DeliverEmailCommand(ACTOR, input({ attemptNumber: 3, maxAttempts: 3 })))).rejects.toBeInstanceOf(EmailDeliveryAbandonedError);
		expect(exhausted.logs.status(EMAIL_LOG_ID)).toBe("failed");
	});

	it("abandons queued props that no longer pass the template's schema, without calling the provider", async () => {
		const { handler, logs, delivery } = setup();

		await expect(handler.execute(new DeliverEmailCommand(ACTOR, input({ props: { to: "not-an-email" } })))).rejects.toBeInstanceOf(EmailDeliveryAbandonedError);
		expect(logs.status(EMAIL_LOG_ID)).toBe("failed");
		expect(delivery.calls).toEqual([]);
	});

	it("emits nothing when another writer finalized the row first (lost compare-and-set)", async () => {
		const { handler, logs, scope } = setup();
		logs.finalizedBehindOurBack = true;

		await handler.execute(new DeliverEmailCommand(ACTOR, input()));

		expect(scope.events.take()).toEqual([]);
	});

	it("reports a sent email whose row could not be finalized distinctly (the provider key prevents a second send on retry)", async () => {
		const { handler, logs } = setup();
		logs.failFinalize = true;

		await expect(handler.execute(new DeliverEmailCommand(ACTOR, input()))).rejects.toBeInstanceOf(EmailSentButNotRecordedError);
	});
});
