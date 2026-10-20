import { EmailRenderContextSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig, type TestEnv } from "../../../../../../test/support/test-api-env";
import { RequestContextService } from "../../../../../platform/infrastructure/context/request-context";
import { LogService } from "../../../../../platform/infrastructure/logging/logs.service";
import { EmailDeliveryFailure } from "../../../application/ports/email-delivery.port";
import { AdminAlertEmailTemplate } from "../../../domain/templates/admin-alert-email.template";
import { EmailDeliveryAdapter } from "../email-delivery.adapter";
import { EmailTransport, EmailTransportError, type EmailDeliveryReceipt, type OutboundEmail } from "../transports/email-transport";

const EMAIL_LOG_ID = "6b1f3e2a-9c4d-4e5f-8a7b-1c2d3e4f5a6b";
const RENDER = EmailRenderContextSchema.parse({ appName: "Kit", appUrl: "https://app.example.com", supportEmail: "support@example.com" });

/** A provider that answers each call with the next scripted outcome ("hang" never resolves). */
class ScriptedTransport extends EmailTransport {
	public readonly provider = "resend";
	public readonly sent: OutboundEmail[] = [];

	public constructor(private readonly outcomes: (EmailDeliveryReceipt | Error | "hang")[]) {
		super();
	}

	public deliver(email: OutboundEmail): Promise<EmailDeliveryReceipt> {
		this.sent.push(email);
		const outcome = this.outcomes.shift() ?? { providerMessageId: "msg-1", resendId: "resend-1" };
		if (outcome === "hang") {
			return new Promise<EmailDeliveryReceipt>((): void => undefined);
		}
		return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
	}
}

function adapter(transport: ScriptedTransport, env: TestEnv = {}): EmailDeliveryAdapter {
	return new EmailDeliveryAdapter(createTestTypedConfig({ EMAIL_TIMEOUT_MS: "100", ...env }), new LogService(new RequestContextService()), transport, RENDER);
}

const template = (): AdminAlertEmailTemplate => new AdminAlertEmailTemplate({ to: "ops@example.com", title: "Alert", message: "Body" });

describe("EmailDeliveryAdapter", () => {
	it("makes the provider call idempotent by the email log id, with the rendered template", async () => {
		const transport = new ScriptedTransport([]);

		await expect(adapter(transport).deliver(EMAIL_LOG_ID, template())).resolves.toEqual({ providerMessageId: "msg-1", resendId: "resend-1", deliveredTo: "ops@example.com" });
		expect(transport.sent.map((email) => [email.emailLogId, email.to, email.subject])).toEqual([[EMAIL_LOG_ID, "ops@example.com", "[Admin] Alert"]]);
		expect(transport.sent.at(0)?.html).toContain("Alert");
	});

	it("redirects every email to EMAIL_TEST_TO", async () => {
		const transport = new ScriptedTransport([]);

		await expect(adapter(transport, { EMAIL_TEST_TO: "inbox@example.com" }).deliver(EMAIL_LOG_ID, template())).resolves.toMatchObject({ deliveredTo: "inbox@example.com" });
	});

	it("cuts a hung call off as a retryable timeout (the same idempotency key makes the retry a replay)", async () => {
		await expect(adapter(new ScriptedTransport(["hang"])).deliver(EMAIL_LOG_ID, template())).rejects.toEqual(expect.objectContaining({ reason: "timeout", retryable: true }));
	});

	it.each([
		["rate-limited", { reason: "rate-limited", retryable: false }],
		["rejected", { reason: "api-error", retryable: false }],
		["transient", { reason: "api-error", retryable: true }],
	] satisfies [EmailTransportError["kind"], Pick<EmailDeliveryFailure, "reason" | "retryable">][])("classifies a %s provider failure", async (kind, expected) => {
		const failure = adapter(new ScriptedTransport([new EmailTransportError("provider said no", kind)])).deliver(EMAIL_LOG_ID, template());

		await expect(failure).rejects.toBeInstanceOf(EmailDeliveryFailure);
		await expect(failure).rejects.toMatchObject(expected);
	});

	it("treats an unexpected error as retryable", async () => {
		await expect(adapter(new ScriptedTransport([new Error("socket hang up")])).deliver(EMAIL_LOG_ID, template())).rejects.toMatchObject({
			reason: "api-error",
			retryable: true,
		});
	});
});
