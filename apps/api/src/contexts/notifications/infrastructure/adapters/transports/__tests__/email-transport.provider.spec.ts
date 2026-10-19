import { describe, expect, it } from "vitest";

import { RequestContextService } from "../../../../../../platform/infrastructure/context/request-context";
import { LogService } from "../../../../../../platform/infrastructure/logging/logs.service";
import { createTestApiConfig } from "../../../../../../../test/support/test-api-env";
import { createEmailTransport } from "../email-transport.provider";
import { MailpitEmailTransport } from "../mailpit-email.transport";
import { ResendEmailTransport } from "../resend-email.transport";

const logService = new LogService(new RequestContextService());

describe("createEmailTransport", () => {
	it("selects Resend by default", () => {
		const transport = createEmailTransport(createTestApiConfig({ EMAIL_MODE: "send", RESEND_API_KEY: "re_test_only" }).email, logService);

		expect(transport).toBeInstanceOf(ResendEmailTransport);
		expect(transport.provider).toBe("resend");
	});

	it("selects the local Mailpit inbox with EMAIL_PROVIDER=mailpit", () => {
		const transport = createEmailTransport(createTestApiConfig({ EMAIL_MODE: "send", EMAIL_PROVIDER: "mailpit" }).email, logService);

		expect(transport).toBeInstanceOf(MailpitEmailTransport);
		expect(transport.provider).toBe("mailpit");
	});
});
