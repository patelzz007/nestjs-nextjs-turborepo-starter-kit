import { Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	EmailPreviewSchema,
	EmailRenderContextSchema,
	EmailSendResultSchema,
	EmailTemplateKeyParamSchema,
	EmailTemplateMetaSchema,
	type EmailPreview,
	type EmailRenderContext,
	type EmailSendResult,
	type EmailTemplateMeta,
	apiPath,
} from "@workspace/shared";

import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { createWrappedDto, createWrappedArrayDto } from "../../../common/dto/response-wrapper";
import { TypedConfigService } from "../../../config/typed-config.service";
import { EMAIL_TEMPLATE_REGISTRY, buildEmailPreview, listTemplateMeta } from "./email-template.registry";
import { EmailSenderService } from "./email-sender.service";

// ── Wrapped Response DTOs ────────────────────────────────────────────────

const WrappedPreviewList = createWrappedArrayDto(EmailTemplateMetaSchema, "WrappedEmailPreviewList");
const WrappedPreviewDetail = createWrappedDto(EmailPreviewSchema, "WrappedEmailPreviewDetail");
const WrappedSendResult = createWrappedDto(EmailSendResultSchema, "WrappedEmailSendResult");

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
	@ApiOkResponse({ type: WrappedPreviewList, description: "Metadata for every registered email template" })
	public list(): { readonly templates: readonly EmailTemplateMeta[] } {
		return { templates: listTemplateMeta() };
	}

	/** Rendered HTML + plain text for one template (sample props only). */
	@RequirePermission("READ", "EMAIL")
	@Get(":key")
	@ApiOperation({ summary: "Render one email template preview" })
	@ApiOkResponse({ type: WrappedPreviewDetail, description: "Rendered preview for one template" })
	@ApiNotFoundResponse({ description: "Unknown template key" })
	public detail(@Param("key", new ZodValidationPipe(EmailTemplateKeyParamSchema)) key: string): EmailPreview {
		const parsedKey = EmailTemplateKeyParamSchema.safeParse(key);
		if (!parsedKey.success) {
			throw new NotFoundException(`Unknown email template: ${key}`);
		}
		try {
			return buildEmailPreview(parsedKey.data, this.renderContext);
		} catch {
			throw new NotFoundException(`Unknown email template: ${key}`);
		}
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
	@ApiOkResponse({ type: WrappedSendResult, description: "Outcome of the send attempt" })
	@ApiNotFoundResponse({ description: "Unknown template key" })
	public async sendTest(@Param("key", new ZodValidationPipe(EmailTemplateKeyParamSchema)) key: string): Promise<EmailSendResult> {
		const parsedKey = EmailTemplateKeyParamSchema.safeParse(key);
		if (!parsedKey.success) {
			throw new NotFoundException(`Unknown email template: ${key}`);
		}
		// Guard sample-prop construction the same way `detail()` does — a bad
		// registry entry surfaces as a 404 (missing template), not a 500.
		try {
			const template = EMAIL_TEMPLATE_REGISTRY[parsedKey.data].build();
			return await this.sender.send(template);
		} catch {
			throw new NotFoundException(`Unknown email template: ${key}`);
		}
	}
}
