import { Controller, Get, HttpStatus, NotFoundException, Post } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	EmailPreviewListResponseSchema,
	EmailPreviewSchema,
	EmailRenderContextSchema,
	EmailSendResultSchema,
	EmailTemplateKeyParamSchema,
	type EmailPreview,
	type EmailPreviewListResponse,
	type EmailRenderContext,
	type EmailSendResult,
	type EmailTemplateKey,
	apiPath,
} from "@workspace/shared";

import { ZodParam } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { TypedConfigService } from "../../../config/typed-config.service";
import { EMAIL_TEMPLATE_REGISTRY, buildEmailPreview, listTemplateMeta } from "./email-template.registry";
import { EmailSenderService } from "./email-sender.service";

/**
 * Admin-only preview endpoints. The admin panel lists every template, then
 * fetches the rendered HTML / text for one template to display in an iframe.
 *
 * These endpoints only render **sample** props (never real user data) and
 * never send mail — they exist so a designer can inspect the exact output of
 * every template without a real recipient.
 */
@ApiTags("Email Templates")
@AdminAccessOnly("Admin access required to preview email templates.")
@Controller(apiPath("/notifications/email-preview"))
export class EmailPreviewController {
	private readonly renderContext: EmailRenderContext;

	/** Validates a template key exists in the registry or throws 404. */
	private requireTemplate(key: string): EmailTemplateKey {
		const parsed = EmailTemplateKeyParamSchema.safeParse(key);
		if (!parsed.success) {
			throw new NotFoundException(`Unknown email template: ${key}`);
		}
		if (!(parsed.data in EMAIL_TEMPLATE_REGISTRY)) {
			throw new NotFoundException(`Unknown email template: ${key}`);
		}
		return parsed.data;
	}

	constructor(
		private readonly config: TypedConfigService,
		private readonly sender: EmailSenderService,
	) {
		this.renderContext = EmailRenderContextSchema.parse({
			appName: this.config.appName,
			appUrl: this.config.appUrl,
			supportEmail: this.config.emailFromAddress,
		});
	}

	/** Static metadata for every template — powers the admin preview index. */
	@RequirePermission("READ", "EMAIL")
	@Get()
	@ApiOperation({ summary: "List email template metadata" })
	@ZodResponse(EmailPreviewListResponseSchema, { description: "Metadata for every registered email template" })
	public list(): EmailPreviewListResponse {
		return { templates: listTemplateMeta() };
	}

	/** Rendered HTML + plain text for one template (sample props only). */
	@RequirePermission("READ", "EMAIL")
	@Get(":key")
	@ApiOperation({ summary: "Render one email template preview" })
	@ZodResponse(EmailPreviewSchema, { description: "Rendered preview for one template" })
	@ApiNotFoundResponse({ description: "Unknown template key" })
	public detail(@ZodParam("key", EmailTemplateKeyParamSchema) key: string): EmailPreview {
		const parsedKey = this.requireTemplate(key);
		return buildEmailPreview(parsedKey, this.renderContext);
	}

	/**
	 * Send ONE template with its sample props to the `EMAIL_TEST_TO` override
	 * (dev) or the sample recipient. Admin-only; never sends real user data.
	 * Returns the same `EmailSendResult` the auth flows get — so the admin can
	 * see the exact outcome (id / mode / failure reason) for every template.
	 */
	@RequirePermission("CREATE", "EMAIL")
	@Post(":key/send")
	@ApiOperation({ summary: "Send one email template (sample props)" })
	@ZodResponse(EmailSendResultSchema, { status: HttpStatus.CREATED, description: "Outcome of the send attempt" })
	@ApiNotFoundResponse({ description: "Unknown template key" })
	public async sendTest(@ZodParam("key", EmailTemplateKeyParamSchema) key: string): Promise<EmailSendResult> {
		const parsedKey = this.requireTemplate(key);
		const entry = EMAIL_TEMPLATE_REGISTRY[parsedKey];
		const template = entry.build();
		return this.sender.send(template);
	}
}
