import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { APP_LINKS, EMAIL_VERIFICATION_LINK_TTL_HOURS, PASSWORD_RESET_LINK_TTL_HOURS } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { AdminAlertEmailTemplate } from "../../notifications/email/templates/admin-alert-email.template";
import { PasswordResetEmailTemplate } from "../../notifications/email/templates/password-reset-email.template";
import { VerificationEmailTemplate } from "../../notifications/email/templates/verification-email.template";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { EmailService } from "./email.service";
import { TokenService } from "./token.service";

/**
 * The lifetime an emailed link states, the lifetime the API enforces, and the
 * lifetime the frontends quote all come from ONE shared constant
 * (`packages/shared/src/schemas/auth/email-link-lifetimes.ts`).
 */

const SECONDS_PER_HOUR = 3600;

const JwtTimesSchema = z.object({ iat: z.number(), exp: z.number() });

/** An `EmailService` whose sender captures every template it was asked to send. */
async function capturingEmailService(): Promise<{ readonly service: EmailService; readonly sent: object[]; readonly config: TypedConfigService }> {
	const sent: object[] = [];
	const config = createTestTypedConfig();
	const moduleRef = await Test.createTestingModule({
		providers: [
			EmailService,
			{ provide: TypedConfigService, useValue: config },
			{
				provide: EmailSenderService,
				useValue: {
					send: (template: object): Promise<{ readonly status: string }> => {
						sent.push(template);
						return Promise.resolve({ status: "sent" });
					},
				},
			},
		],
	}).compile();
	return { service: moduleRef.get(EmailService), sent, config };
}

describe("email-link lifetimes come from the shared constants", () => {
	it("signs the email-verification token for exactly EMAIL_VERIFICATION_LINK_TTL_HOURS", async () => {
		const jwt = new JwtService();
		const token = await new TokenService(jwt, createTestTypedConfig()).generateEmailVerificationToken("user@example.com");

		const { iat, exp } = JwtTimesSchema.parse(jwt.decode(token));
		expect(exp - iat).toBe(EMAIL_VERIFICATION_LINK_TTL_HOURS * SECONDS_PER_HOUR);
	});

	it("states the shared lifetimes in the verification and password-reset emails", async () => {
		const { service, sent } = await capturingEmailService();

		await service.sendVerificationEmail("user@example.com", "verify-token");
		await service.sendPasswordResetEmail("user@example.com", "reset-token");

		const [verification, reset] = sent;
		expect(z.instanceof(VerificationEmailTemplate).parse(verification).props.expiresInHours).toBe(EMAIL_VERIFICATION_LINK_TTL_HOURS);
		expect(z.instanceof(PasswordResetEmailTemplate).parse(reset).props.expiresInHours).toBe(PASSWORD_RESET_LINK_TTL_HOURS);
	});

	it("links MFA-recovery review emails to the PENDING queue (filter[status]=PENDING), not every status", async () => {
		const { service, sent, config } = await capturingEmailService();

		await service.sendMfaRecoveryAdminNotification("admin@example.com", "MFA Recovery Review Required", "Please review.");

		const template = z.instanceof(AdminAlertEmailTemplate).parse(sent.at(0));
		const link = new URL(z.string().parse(template.props.action?.url));
		expect(link.origin).toBe(new URL(config.adminAppUrl).origin);
		expect(`${link.pathname}${link.search}`).toBe(APP_LINKS.admin.mfaRecoveryPendingQueue);
		expect(link.searchParams.get("filter[status]")).toBe("PENDING");
	});
});
