import { Get, HttpStatus, NotFoundException, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiNotFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	EmailPreviewListResponseSchema,
	EmailPreviewSchema,
	EmailSendResultSchema,
	EmailTemplateKeyParamSchema,
	type EmailPreview,
	type EmailPreviewListResponse,
	type EmailSendResult,
	type EmailTemplateKey,
} from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { SendTestEmailCommand } from "../../application/commands/send-test-email/send-test-email.command";
import { EMAIL_LOG_WRITE_OPERATION } from "../../application/notifications-scope";
import { EmailPreviewApplicationService } from "../../application/services/email-preview.application-service";
import { EMAIL_TEMPLATE_REGISTRY } from "../../domain/templates/email-template.registry";

/** Validates a template key exists in the registry or throws 404. */
function requireTemplate(key: string): EmailTemplateKey {
	const parsed = EmailTemplateKeyParamSchema.safeParse(key);
	if (!parsed.success || !(parsed.data in EMAIL_TEMPLATE_REGISTRY)) {
		throw new NotFoundException(`Unknown email template: ${key}`);
	}
	return parsed.data;
}

/**
 * Admin-only preview endpoints. The admin panel lists every template, then
 * fetches the rendered HTML / text for one template to display in an iframe.
 *
 * These endpoints only render **sample** props (never real user data); only
 * the explicit test send below sends mail.
 */
@ApiTags("Email Templates")
@AdminAccessOnly("Admin access required to preview email templates.")
@ApiController("/notifications/email-preview")
export class EmailPreviewController {
	public constructor(
		private readonly previews: EmailPreviewApplicationService,
		private readonly commandBus: CommandBus,
	) {}

	/** Static metadata for every template — powers the admin preview index. */
	@RequirePermission("READ", "EMAIL")
	@Get()
	@ApiOperation({ summary: "List email template metadata" })
	@ZodResponse(EmailPreviewListResponseSchema, { description: "Metadata for every registered email template" })
	public list(): EmailPreviewListResponse {
		return this.previews.listTemplates();
	}

	/** Rendered HTML + plain text for one template (sample props only). */
	@RequirePermission("READ", "EMAIL")
	@Get(":key")
	@ApiOperation({ summary: "Render one email template preview" })
	@ZodResponse(EmailPreviewSchema, { description: "Rendered preview for one template" })
	@ApiNotFoundResponse({ description: "Unknown template key" })
	public detail(@ZodParam("key", EmailTemplateKeyParamSchema) key: string): EmailPreview {
		return this.previews.preview(requireTemplate(key));
	}

	/**
	 * Send ONE template with its sample props to the `EMAIL_TEST_TO` override
	 * (dev) or the sample recipient. Admin-only; never sends real user data.
	 * Returns the `EmailSendResult` of the request (id / mode / failure reason).
	 *
	 * Audited: the email log row of the send records `trigger=admin-test-send`,
	 * the acting admin, correlation id, IP and user agent (on top of the global
	 * HTTP audit entry every state-changing request gets).
	 */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "EMAIL")
	@PlatformOperation(EMAIL_LOG_WRITE_OPERATION)
	@Post(":key/send")
	@ApiOperation({ summary: "Send one email template (sample props)" })
	@ZodResponse(EmailSendResultSchema, { status: HttpStatus.CREATED, description: "Outcome of the send attempt" })
	@ApiNotFoundResponse({ description: "Unknown template key" })
	public async sendTest(@CurrentActor() actor: ActorContext, @ZodParam("key", EmailTemplateKeyParamSchema) key: string): Promise<EmailSendResult> {
		return this.commandBus.execute(new SendTestEmailCommand(actor, { templateKey: requireTemplate(key) }));
	}
}
